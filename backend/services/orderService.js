const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const PRODUCT_STATUS = require("../constants/productStatus");
const VENDOR_STATUS = require("../constants/vendorStatus");
const { ORDER_STATUS, ORDER_STATUS_SEQUENCE } = require("../constants/orderStatus");

class CheckoutError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.statusCode = 400;
    this.errors = errors;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

// Re-reads every cart item FRESH, inside the transaction, and re-checks everything
// the spec asks for (exists, ACTIVE, vendor APPROVED, enough stock). This runs at
// commit time, not as a separate "check then act" step, so a last-second stock
// change by another customer can't slip a bad order through (the whole point of
// doing this inside a transaction rather than validating first and creating after).
const createOrderFromCart = async (userId) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ user: userId }).session(session);
      const items = cart
        ? await CartItem.find({ cart: cart._id })
            .populate({ path: "product", populate: { path: "vendor" } })
            .session(session)
        : [];

      if (items.length === 0) {
        throw new CheckoutError("Your cart is empty");
      }

      const errors = [];
      for (const item of items) {
        const product = item.product;
        if (!product) {
          errors.push({ productId: item.product, message: "This product no longer exists" });
        } else if (product.status !== PRODUCT_STATUS.ACTIVE) {
          errors.push({ productId: product._id, message: `${product.name} is no longer available` });
        } else if (!product.vendor || product.vendor.status !== VENDOR_STATUS.APPROVED) {
          errors.push({ productId: product._id, message: `${product.name}'s vendor is not currently active` });
        } else if (item.quantity > product.stock) {
          errors.push({ productId: product._id, message: `Only ${product.stock} left of ${product.name}` });
        }
      }

      if (errors.length) {
        throw new CheckoutError("Some items in your cart are no longer available", errors);
      }

      // Prices come from the DB record read above, never from the request.
      const subtotal = round2(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
      const shippingAmount = 0;
      const discountAmount = 0;
      const taxAmount = 0;
      const totalAmount = round2(subtotal + shippingAmount - discountAmount + taxAmount);

      const [order] = await Order.create(
        [{ user: userId, subtotal, shippingAmount, discountAmount, taxAmount, totalAmount }],
        { session },
      );

      const orderItemDocs = items.map((item) => ({
        order: order._id,
        product: item.product._id,
        vendor: item.product.vendor._id,
        productName: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
        subtotal: round2(item.product.price * item.quantity),
      }));
      await OrderItem.insertMany(orderItemDocs, { session });

      for (const item of items) {
        item.product.stock -= item.quantity;
        await item.product.save({ session });
      }

      await CartItem.deleteMany({ cart: cart._id }).session(session);

      result = order._id;
    });

    return getOrderForUser(result, userId);
  } finally {
    await session.endSession();
  }
};

// Order.status reflects the LEAST advanced of its still-active (non-cancelled)
// item statuses -- a multi-vendor order isn't "Shipped" overall until every
// vendor's part has shipped. If every item is cancelled, the order is cancelled.
const recomputeOrderStatus = async (orderId, session) => {
  const items = await OrderItem.find({ order: orderId }).session(session || null);
  const active = items.filter((i) => i.status !== ORDER_STATUS.CANCELLED);

  const status = active.length === 0
    ? ORDER_STATUS.CANCELLED
    : active.reduce((lowest, item) => {
        const rank = ORDER_STATUS_SEQUENCE.indexOf(item.status);
        return rank < ORDER_STATUS_SEQUENCE.indexOf(lowest) ? item.status : lowest;
      }, ORDER_STATUS_SEQUENCE[ORDER_STATUS_SEQUENCE.length - 1]);

  await Order.findByIdAndUpdate(orderId, { status }).session(session || null);
  return status;
};

const toOrderDTO = (order, items) => ({
  id: order._id,
  status: order.status,
  subtotal: order.subtotal,
  shippingAmount: order.shippingAmount,
  discountAmount: order.discountAmount,
  taxAmount: order.taxAmount,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt,
  items: items.map((item) => ({
    id: item._id,
    productId: item.product,
    productName: item.productName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    subtotal: item.subtotal,
    status: item.status,
    vendor: item.vendor?.storeName
      ? { id: item.vendor._id, storeName: item.vendor.storeName }
      : { id: item.vendor },
  })),
});

const getOrderForUser = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) return null;
  const items = await OrderItem.find({ order: order._id }).populate("vendor", "storeName");
  return toOrderDTO(order, items);
};

const listOrdersForUser = async (userId) => {
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
  const all = [];
  for (const order of orders) {
    const items = await OrderItem.find({ order: order._id }).populate("vendor", "storeName");
    all.push(toOrderDTO(order, items));
  }
  return all;
};

// A vendor can only move their segment one step forward at a time, or cancel it
// (unless it's already been delivered or cancelled). No skipping steps, no going
// backward -- that's what "validate allowed status transitions" means here.
const isValidTransition = (current, next) => {
  if (current === ORDER_STATUS.CANCELLED || current === ORDER_STATUS.DELIVERED) return false;
  if (next === ORDER_STATUS.CANCELLED) return true;
  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(current);
  const nextIndex = ORDER_STATUS_SEQUENCE.indexOf(next);
  return nextIndex === currentIndex + 1;
};

module.exports = {
  CheckoutError,
  createOrderFromCart,
  getOrderForUser,
  listOrdersForUser,
  recomputeOrderStatus,
  isValidTransition,
  toOrderDTO,
  round2,
};

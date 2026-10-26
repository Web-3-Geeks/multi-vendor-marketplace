const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const PRODUCT_STATUS = require("../constants/productStatus");
const VENDOR_STATUS = require("../constants/vendorStatus");
const { ORDER_STATUS, ORDER_STATUS_SEQUENCE } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { setCommissionStatus } = require("./commissionService");
const { ORDER_TRANSITIONS, ORDER_PAYMENT_TRANSITIONS, canTransition, fromStates } = require("./stateMachine");
const audit = require("./auditService");
const { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_SOURCE } = require("../constants/audit");
const { round2 } = require("../utils/money");
const { pageInfo } = require("../utils/pagination");

class CheckoutError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.statusCode = 400;
    this.errors = errors;
  }
}

class OrderError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Re-reads every cart item FRESH, inside the transaction, and re-checks everything
// the spec asks for (exists, ACTIVE, vendor APPROVED, enough stock). This runs at
// commit time, not as a separate "check then act" step, so a last-second stock
// change by another customer can't slip a bad order through (the whole point of
// doing this inside a transaction rather than validating first and creating after).
const createOrderFromCart = async (userId, shippingAddress) => {
  await cancelStaleUnpaidOrders();
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
        [{ user: userId, shippingAddress, subtotal, shippingAmount, discountAmount, taxAmount, totalAmount }],
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

const toShippingAddressDTO = (address) =>
  address && {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 || null,
    city: address.city,
    state: address.state || null,
    postalCode: address.postalCode,
    country: address.country,
  };

const toOrderDTO = (order, items) => ({
  id: order._id,
  status: order.status,
  paymentStatus: order.paymentStatus,
  shippingAddress: toShippingAddressDTO(order.shippingAddress) || null,
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

// One page of the caller's orders. The items of every order on the page are fetched
// in a single query (not one query per order), and grouped here.
const listOrdersForUser = async (userId, { page = 1, limit = 10, skip = 0 } = {}) => {
  const [orders, total] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments({ user: userId }),
  ]);

  const items = await OrderItem.find({ order: { $in: orders.map((order) => order._id) } }).populate(
    "vendor",
    "storeName",
  );
  const byOrder = new Map();
  for (const item of items) {
    const key = String(item.order);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(item);
  }

  return {
    orders: orders.map((order) => toOrderDTO(order, byOrder.get(String(order._id)) || [])),
    pagination: pageInfo(page, limit, total),
  };
};

// One step forward at a time, or cancel -- never skip a step or go backward. The
// actual rules live in services/stateMachine.js.
const isValidTransition = (current, next) => canTransition(ORDER_TRANSITIONS, current, next);

const cancelItems = async (items, session) => {
  for (const item of items) {
    const product = await Product.findById(item.product).session(session);
    if (product) {
      product.stock += item.quantity;
      await product.save({ session });
    }
  }
  const ids = items.map((item) => item._id);
  await OrderItem.updateMany({ _id: { $in: ids } }, { status: ORDER_STATUS.CANCELLED }, { session });
  await setCommissionStatus({ orderItem: { $in: ids } }, COMMISSION_STATUS.CANCELLED, session);
};

// Shared by the vendor endpoint (vendorId set: only that vendor's items) and the
// admin endpoint (whole order, cancelled items skipped). Everything runs in one
// transaction so stock, commissions and the order's derived status stay consistent.
const updateItemsStatus = async (orderId, status, { vendorId, activeOnly = false, actor = null } = {}) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      const filter = { order: orderId };
      if (vendorId) filter.vendor = vendorId;
      let items = await OrderItem.find(filter).session(session);
      if (activeOnly) items = items.filter((item) => item.status !== ORDER_STATUS.CANCELLED);

      if (!order || (vendorId && items.length === 0)) throw new OrderError("Order not found", 404);
      if (items.length === 0) throw new OrderError("This order has no active items");

      if (status !== ORDER_STATUS.CANCELLED && order.paymentStatus !== PAYMENT_STATUS.PAID) {
        throw new OrderError("This order has not been paid yet");
      }

      const invalid = items.find((item) => !isValidTransition(item.status, status));
      if (invalid) throw new OrderError(`Cannot move an item from ${invalid.status} to ${status}`);

      if (status === ORDER_STATUS.CANCELLED) {
        await cancelItems(items, session);
      } else {
        const ids = items.map((item) => item._id);
        await OrderItem.updateMany({ _id: { $in: ids } }, { status }, { session });
        if (status === ORDER_STATUS.DELIVERED) {
          await setCommissionStatus({ orderItem: { $in: ids } }, COMMISSION_STATUS.PAID, session);
        }
      }

      const orderStatus = await recomputeOrderStatus(orderId, session);
      if (orderStatus === ORDER_STATUS.CANCELLED) {
        await Order.updateOne(
          { _id: orderId, paymentStatus: { $in: fromStates(ORDER_PAYMENT_TRANSITIONS, PAYMENT_STATUS.CANCELLED) } },
          { paymentStatus: PAYMENT_STATUS.CANCELLED },
          { session },
        );
      }

      await audit.record(
        {
          actor,
          action: AUDIT_ACTION.ORDER_STATUS_CHANGED,
          entityType: AUDIT_ENTITY.ORDER,
          entityId: orderId,
          order: orderId,
          metadata: {
            itemStatus: status,
            itemCount: items.length,
            orderStatusFrom: order.status,
            orderStatusTo: orderStatus,
            ...(vendorId ? { vendorId } : {}),
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
};

const UNPAID_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_BATCH_SIZE = 50;

const cancelUnpaidOrder = async (orderId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: ORDER_STATUS.PENDING,
          paymentStatus: { $in: fromStates(ORDER_PAYMENT_TRANSITIONS, PAYMENT_STATUS.CANCELLED) },
        },
        { status: ORDER_STATUS.CANCELLED, paymentStatus: PAYMENT_STATUS.CANCELLED },
        { session },
      );
      if (!order) return;

      const items = await OrderItem.find({ order: orderId }).session(session);
      await cancelItems(items, session);

      await audit.record(
        {
          source: AUDIT_SOURCE.SYSTEM,
          action: AUDIT_ACTION.ORDER_AUTO_CANCELLED,
          entityType: AUDIT_ENTITY.ORDER,
          entityId: orderId,
          order: orderId,
          metadata: {
            reason: "Unpaid for 24 hours",
            orderStatusFrom: order.status,
            orderStatusTo: ORDER_STATUS.CANCELLED,
            totalAmount: order.totalAmount,
          },
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
};

// There is no background worker on Vercel serverless, so abandoned orders are
// cleaned up lazily: whenever someone checks out or an admin opens the order
// list/stats, orders unpaid for 24h are cancelled and their stock released.
// Orders from before payments existed have no paymentStatus field, so they never match.
const cancelStaleUnpaidOrders = async () => {
  try {
    const stale = await Order.find({
      status: ORDER_STATUS.PENDING,
      paymentStatus: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] },
      createdAt: { $lt: new Date(Date.now() - UNPAID_ORDER_TTL_MS) },
    })
      .select("_id")
      .limit(STALE_BATCH_SIZE);

    for (const { _id } of stale) {
      await cancelUnpaidOrder(_id);
    }
  } catch (err) {
    console.error("Failed to cancel stale unpaid orders:", err.message);
  }
};

module.exports = {
  CheckoutError,
  OrderError,
  cancelItems,
  cancelStaleUnpaidOrders,
  updateItemsStatus,
  createOrderFromCart,
  getOrderForUser,
  listOrdersForUser,
  recomputeOrderStatus,
  isValidTransition,
  toOrderDTO,
  toShippingAddressDTO,
  round2,
};

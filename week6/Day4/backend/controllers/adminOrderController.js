const { matchedData } = require("express-validator");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const User = require("../models/User");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const {
  OrderError,
  toOrderDTO,
  updateItemsStatus,
  cancelStaleUnpaidOrders,
} = require("../services/orderService");
const { toPaymentDTO } = require("../services/paymentService");
const escapeRegex = require("../utils/escapeRegex");

const DEFAULT_LIMIT = 20;
const FULL_ID = /^[0-9a-f]{24}$/i;
const SHORT_ID = /^[0-9a-f]{8}$/i;

const toCustomer = (user) => user && { id: user._id, name: user.name, email: user.email };

// The UI shows orders as "#" + the last 8 characters of the id, so admins can
// search by that short form as well as by the full id or the customer's name/email.
const buildSearchFilter = async (search) => {
  const pattern = new RegExp(escapeRegex(search), "i");
  const userIds = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).distinct("_id");

  const or = [{ user: { $in: userIds } }];
  if (FULL_ID.test(search)) or.push({ _id: search });
  if (SHORT_ID.test(search)) {
    or.push({
      $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${search}$`, options: "i" } },
    });
  }
  return { $or: or };
};

const listOrders = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  await cancelStaleUnpaidOrders();

  const filter = q.search ? await buildSearchFilter(q.search) : {};
  if (q.status) filter.status = q.status;
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  const counts = await OrderItem.aggregate([
    { $match: { order: { $in: orders.map((o) => o._id) } } },
    { $group: { _id: "$order", count: { $sum: 1 } } },
  ]);
  const countByOrder = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    orders: orders.map((order) => ({
      id: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      itemCount: countByOrder.get(String(order._id)) || 0,
      customer: toCustomer(order.user),
      createdAt: order.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

const loadAdminOrder = async (orderId) => {
  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) return null;
  const [items, payments] = await Promise.all([
    OrderItem.find({ order: order._id }).populate("vendor", "storeName"),
    Payment.find({ order: order._id }).sort({ createdAt: -1 }),
  ]);
  return {
    ...toOrderDTO(order, items),
    customer: toCustomer(order.user),
    payments: payments.map(toPaymentDTO),
  };
};

const getOrder = async (req, res) => {
  const order = await loadAdminOrder(req.params.id);
  if (!order) throw new OrderError("Order not found", 404);
  res.json({ order });
};

const updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new OrderError("Order not found", 404);
  if (status === ORDER_STATUS.CANCELLED && order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new OrderError("A paid order must be refunded to be cancelled");
  }

  await updateItemsStatus(order._id, status, { activeOnly: true });

  res.json({ order: await loadAdminOrder(order._id) });
};

module.exports = { listOrders, getOrder, updateOrderStatus };

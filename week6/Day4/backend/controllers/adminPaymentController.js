const { matchedData } = require("express-validator");
const Payment = require("../models/Payment");
const OrderItem = require("../models/OrderItem");
const { PaymentError, toAdminPaymentDTO, refundPayment } = require("../services/paymentService");
const escapeRegex = require("../utils/escapeRegex");
const buildDateRange = require("../utils/dateRange");

const DEFAULT_LIMIT = 20;

const populatePayment = (query) =>
  query.populate("user", "name email").populate("order", "status paymentStatus totalAmount");

const listPayments = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.search) filter.transactionId = new RegExp(escapeRegex(q.search), "i");
  const createdAt = buildDateRange(q.from, q.to);
  if (createdAt) filter.createdAt = createdAt;

  const [payments, total] = await Promise.all([
    populatePayment(Payment.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  res.json({
    payments: payments.map(toAdminPaymentDTO),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

const getPayment = async (req, res) => {
  const payment = await populatePayment(Payment.findById(req.params.id));
  if (!payment) throw new PaymentError("Payment not found", 404);

  const items = await OrderItem.find({ order: payment.order._id }).populate("vendor", "storeName");

  res.json({
    payment: {
      ...toAdminPaymentDTO(payment),
      items: items.map((item) => ({
        id: item._id,
        productName: item.productName,
        quantity: item.quantity,
        subtotal: item.subtotal,
        status: item.status,
        vendor: item.vendor && { id: item.vendor._id, storeName: item.vendor.storeName },
      })),
    },
  });
};

const refund = async (req, res) => {
  const payment = await refundPayment(req.user._id, req.params.id, req.body.reason);
  res.json({ payment: toAdminPaymentDTO(payment) });
};

module.exports = { listPayments, getPayment, refund };

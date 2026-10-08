const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const { getProvider } = require("./payment");
const mongoose = require("mongoose");
const OrderItem = require("../models/OrderItem");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { createCommissionsForOrder, setCommissionStatus } = require("./commissionService");
const { cancelItems, recomputeOrderStatus } = require("./orderService");

const CURRENCY = "USD";
const OPEN_STATUSES = [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING];

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const toPaymentDTO = (payment) => ({
  id: payment._id,
  orderId: payment.order,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  transactionId: payment.transactionId,
  paymentMethod: payment.paymentMethod,
  expiresAt: payment.expiresAt,
  paidAt: payment.paidAt,
});

const toCreateResponse = (payment) => ({
  payment: toPaymentDTO(payment),
  publicKey: process.env.PAYMENT_PUBLIC_KEY,
});

const findOpenPayment = (orderId) =>
  Payment.findOne({
    order: orderId,
    status: { $in: OPEN_STATUSES },
    expiresAt: { $gt: new Date() },
  });

const createPaymentForOrder = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new PaymentError("Order not found", 404);
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new PaymentError("A cancelled order cannot be paid");
  }
  if (
    [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED].includes(order.paymentStatus)
  ) {
    throw new PaymentError("This order has already been paid", 409);
  }

  const existing = await findOpenPayment(order._id);
  if (existing) return toCreateResponse(existing);

  await Payment.updateMany(
    {
      order: order._id,
      status: { $in: OPEN_STATUSES },
      expiresAt: { $lte: new Date() },
    },
    { status: PAYMENT_STATUS.CANCELLED },
  );

  const intent = await getProvider().createIntent({
    amount: order.totalAmount,
    currency: CURRENCY,
    orderId: order._id,
  });

  try {
    const payment = await Payment.create({
      order: order._id,
      user: userId,
      amount: order.totalAmount,
      currency: CURRENCY,
      provider: process.env.PAYMENT_PROVIDER,
      transactionId: intent.transactionId,
      paymentMethod: "card",
      expiresAt: intent.expiresAt,
    });
    return toCreateResponse(payment);
  } catch (err) {
    if (err.code === 11000) {
      const open = await findOpenPayment(order._id);
      if (open) return toCreateResponse(open);
    }
    throw err;
  }
};

const settlePayment = async (paymentId, succeeded, eventId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (eventId) {
        const claimed = await Payment.updateOne(
          { _id: paymentId, processedEventIds: { $ne: eventId } },
          { $addToSet: { processedEventIds: eventId } },
          { session },
        );
        if (claimed.modifiedCount === 0) return;
      }

      const payment = await Payment.findOneAndUpdate(
        { _id: paymentId, status: { $in: OPEN_STATUSES } },
        succeeded
          ? { status: PAYMENT_STATUS.PAID, paidAt: new Date() }
          : { status: PAYMENT_STATUS.FAILED },
        { returnDocument: "after", session },
      );
      if (!payment) return;

      if (succeeded) {
        await Order.updateOne(
          { _id: payment.order },
          { paymentStatus: PAYMENT_STATUS.PAID },
          { session },
        );
        await Order.updateOne(
          { _id: payment.order, status: ORDER_STATUS.PENDING },
          { status: ORDER_STATUS.CONFIRMED },
          { session },
        );
        await OrderItem.updateMany(
          { order: payment.order, status: ORDER_STATUS.PENDING },
          { status: ORDER_STATUS.CONFIRMED },
          { session },
        );
        await createCommissionsForOrder(payment.order, session);
      } else {
        await Order.updateOne(
          { _id: payment.order },
          { paymentStatus: PAYMENT_STATUS.FAILED },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return Payment.findById(paymentId);
};

const verifyPayment = async (userId, transactionId) => {
  const payment = await Payment.findOne({ transactionId, user: userId });
  if (!payment) throw new PaymentError("Payment not found", 404);
  if (!OPEN_STATUSES.includes(payment.status)) return toPaymentDTO(payment);

  const txn = await getProvider().retrieve(transactionId);
  if (!txn)
    throw new PaymentError(
      "Payment provider does not recognise this transaction",
      502,
    );

  const order = await Order.findOne({ _id: payment.order, user: userId });
  const matches =
    order &&
    txn.orderId === String(order._id) &&
    txn.amount === order.totalAmount &&
    txn.amount === payment.amount &&
    txn.currency === payment.currency;
  if (!matches) {
    console.error(
      `Payment ${payment._id} failed verification: provider data does not match the order`,
    );
    throw new PaymentError("Payment details do not match the order");
  }

  if (txn.status === "succeeded")
    return toPaymentDTO(await settlePayment(payment._id, true));
  if (txn.status === "failed")
    return toPaymentDTO(await settlePayment(payment._id, false));

  if (txn.expiresAt <= new Date()) {
    await Payment.updateOne(
      { _id: payment._id, status: { $in: OPEN_STATUSES } },
      { status: PAYMENT_STATUS.CANCELLED },
    );
    return toPaymentDTO(await Payment.findById(payment._id));
  }

  return toPaymentDTO(payment);
};

const WEBHOOK_OUTCOMES = { "payment.succeeded": true, "payment.failed": false };

const handleWebhookEvent = async (event) => {
  if (!Object.hasOwn(WEBHOOK_OUTCOMES, event.type)) return;

  const { transactionId, orderId, amount, currency } = event.data || {};
  const payment =
    typeof transactionId === "string" ? await Payment.findOne({ transactionId }) : null;
  if (!payment) {
    console.error(
      `Webhook ${event.id}: no payment for transaction ${transactionId}`,
    );
    return;
  }

  const matches =
    String(payment.order) === orderId &&
    payment.amount === amount &&
    payment.currency === currency;
  if (!matches) {
    console.error(
      `Webhook ${event.id}: event data does not match payment ${payment._id}`,
    );
    return;
  }

  await settlePayment(payment._id, WEBHOOK_OUTCOMES[event.type], event.id);
};

const simulateMockPayment = async (
  userId,
  transactionId,
  outcome,
  deliverWebhook = true,
) => {
  if (process.env.PAYMENT_PROVIDER !== "mock")
    throw new PaymentError("Not found", 404);

  const payment = await Payment.findOne({ transactionId, user: userId });
  if (!payment) throw new PaymentError("Payment not found", 404);

  const provider = getProvider();
  const delivery = await provider.simulateCustomerPayment(
    transactionId,
    outcome,
  );
  if (!delivery)
    throw new PaymentError("This payment session is no longer open");

  if (deliverWebhook) {
    await handleWebhookEvent(
      provider.verifyWebhook(delivery.rawBody, delivery.signature),
    );
  }
  return toPaymentDTO(await Payment.findById(payment._id));
};

const toAdminPaymentDTO = (payment) => ({
  id: payment._id,
  transactionId: payment.transactionId,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  paymentMethod: payment.paymentMethod,
  paidAt: payment.paidAt,
  expiresAt: payment.expiresAt,
  createdAt: payment.createdAt,
  customer: payment.user && {
    id: payment.user._id,
    name: payment.user.name,
    email: payment.user.email,
  },
  order: payment.order && {
    id: payment.order._id,
    status: payment.order.status,
    paymentStatus: payment.order.paymentStatus,
    totalAmount: payment.order.totalAmount,
  },
  refund: payment.refundedAt
    ? { id: payment.refundId, at: payment.refundedAt, reason: payment.refundReason, by: payment.refundedBy }
    : null,
});

const refundPayment = async (adminId, paymentId, reason) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new PaymentError("Payment not found", 404);
  if (payment.status === PAYMENT_STATUS.REFUNDED) {
    throw new PaymentError("This payment has already been refunded", 409);
  }
  if (payment.status !== PAYMENT_STATUS.PAID) {
    throw new PaymentError("Only a paid payment can be refunded");
  }

  const { refundId } = await getProvider().refund(payment.transactionId);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const refunded = await Payment.findOneAndUpdate(
        { _id: payment._id, status: PAYMENT_STATUS.PAID },
        {
          status: PAYMENT_STATUS.REFUNDED,
          refundId,
          refundedAt: new Date(),
          refundReason: reason,
          refundedBy: adminId,
        },
        { session },
      );
      if (!refunded) return;

      await Order.updateOne(
        { _id: payment.order },
        { paymentStatus: PAYMENT_STATUS.REFUNDED },
        { session },
      );
      await setCommissionStatus({ order: payment.order }, COMMISSION_STATUS.REFUNDED, session, [
        COMMISSION_STATUS.PENDING,
        COMMISSION_STATUS.PAID,
      ]);

      const items = await OrderItem.find({
        order: payment.order,
        status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED] },
      }).session(session);
      if (items.length > 0) {
        await cancelItems(items, session);
        await recomputeOrderStatus(payment.order, session);
      }
    });
  } catch (err) {
    console.error(`Payment ${payment._id} was refunded at the provider but the database update failed`);
    throw err;
  } finally {
    await session.endSession();
  }

  return Payment.findById(payment._id)
    .populate("user", "name email")
    .populate("order", "status paymentStatus totalAmount");
};

const getLatestPaymentForOrder = async (userId, orderId) => {
  const payment = await Payment.findOne({ order: orderId, user: userId }).sort({ createdAt: -1 });
  return payment ? toPaymentDTO(payment) : null;
};

module.exports = {
  PaymentError,
  toPaymentDTO,
  getLatestPaymentForOrder,
  toAdminPaymentDTO,
  createPaymentForOrder,
  verifyPayment,
  handleWebhookEvent,
  simulateMockPayment,
  refundPayment,
};

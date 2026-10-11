const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_SOURCE } = require("../constants/audit");
const { getProvider } = require("./payment");
const { createCommissionsForOrder, setCommissionStatus } = require("./commissionService");
const { cancelItems, recomputeOrderStatus } = require("./orderService");
const { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS, ORDER_PAYMENT_TRANSITIONS, fromStates } = require("./stateMachine");
const audit = require("./auditService");

const CURRENCY = "USD";
// "Open" = can still become PAID. Derived from the state machine, not hard-coded.
const OPEN_STATUSES = fromStates(PAYMENT_TRANSITIONS, PAYMENT_STATUS.PAID);

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

const createPaymentForOrder = async (user, orderId) => {
  const order = await Order.findOne({ _id: orderId, user: user._id });
  if (!order) throw new PaymentError("Order not found", 404);
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new PaymentError("A cancelled order cannot be paid");
  }
  if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED].includes(order.paymentStatus)) {
    throw new PaymentError("This order has already been paid", 409);
  }

  const existing = await findOpenPayment(order._id);
  if (existing) return toCreateResponse(existing);

  const expired = await Payment.find({
    order: order._id,
    status: { $in: OPEN_STATUSES },
    expiresAt: { $lte: new Date() },
  }).select("_id");
  if (expired.length > 0) {
    await Payment.updateMany(
      { _id: { $in: expired.map((p) => p._id) }, status: { $in: fromStates(PAYMENT_TRANSITIONS, PAYMENT_STATUS.CANCELLED) } },
      { status: PAYMENT_STATUS.CANCELLED },
    );
    for (const { _id } of expired) {
      await audit.record({
        source: AUDIT_SOURCE.SYSTEM,
        action: AUDIT_ACTION.PAYMENT_CANCELLED,
        entityType: AUDIT_ENTITY.PAYMENT,
        entityId: _id,
        order: order._id,
        metadata: { reason: "Payment session expired" },
      });
    }
  }

  const intent = await getProvider().createIntent({
    amount: order.totalAmount,
    currency: CURRENCY,
    orderId: order._id,
  });

  try {
    const payment = await Payment.create({
      order: order._id,
      user: user._id,
      amount: order.totalAmount,
      currency: CURRENCY,
      provider: process.env.PAYMENT_PROVIDER,
      transactionId: intent.transactionId,
      paymentMethod: "card",
      expiresAt: intent.expiresAt,
    });
    await audit.record({
      actor: user,
      action: AUDIT_ACTION.PAYMENT_CREATED,
      entityType: AUDIT_ENTITY.PAYMENT,
      entityId: payment._id,
      order: order._id,
      metadata: { amount: payment.amount, currency: payment.currency, provider: payment.provider },
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

// The one place a payment becomes PAID or FAILED, whether the news came from the
// customer's verify call or from the provider's webhook. Everything happens in one
// transaction, and the payment is claimed with a filter built from the state machine,
// so when both arrive at once exactly one of them changes anything.
// `context` is { actor, source } for the audit entry; the event id (webhooks only)
// is remembered on the payment so a repeated event is ignored.
const settlePayment = async (paymentId, succeeded, eventId, context = {}) => {
  const target = succeeded ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.FAILED;
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
        { _id: paymentId, status: { $in: fromStates(PAYMENT_TRANSITIONS, target) } },
        succeeded ? { status: PAYMENT_STATUS.PAID, paidAt: new Date() } : { status: PAYMENT_STATUS.FAILED },
        { returnDocument: "after", session },
      );
      if (!payment) return;

      const orderUpdate = await Order.updateOne(
        { _id: payment.order, paymentStatus: { $in: fromStates(ORDER_PAYMENT_TRANSITIONS, target) } },
        { paymentStatus: target },
        { session },
      );

      let orderConfirmed = false;
      if (succeeded) {
        const confirmed = await Order.updateOne(
          { _id: payment.order, status: { $in: fromStates(ORDER_TRANSITIONS, ORDER_STATUS.CONFIRMED) } },
          { status: ORDER_STATUS.CONFIRMED },
          { session },
        );
        orderConfirmed = confirmed.modifiedCount === 1;
        await OrderItem.updateMany(
          { order: payment.order, status: ORDER_STATUS.PENDING },
          { status: ORDER_STATUS.CONFIRMED },
          { session },
        );
        await createCommissionsForOrder(payment.order, session);
      }

      await audit.record(
        {
          actor: context.actor,
          source: context.source,
          action: succeeded ? AUDIT_ACTION.PAYMENT_PAID : AUDIT_ACTION.PAYMENT_FAILED,
          entityType: AUDIT_ENTITY.PAYMENT,
          entityId: payment._id,
          order: payment.order,
          metadata: {
            amount: payment.amount,
            transactionId: payment.transactionId,
            orderPaymentStatusUpdated: orderUpdate.modifiedCount === 1,
            ...(eventId ? { eventId } : {}),
          },
        },
        session,
      );
      if (orderConfirmed) {
        await audit.record(
          {
            actor: context.actor,
            source: context.source,
            action: AUDIT_ACTION.ORDER_STATUS_CHANGED,
            entityType: AUDIT_ENTITY.ORDER,
            entityId: payment.order,
            order: payment.order,
            metadata: { orderStatusFrom: ORDER_STATUS.PENDING, orderStatusTo: ORDER_STATUS.CONFIRMED, reason: "Payment confirmed" },
          },
          session,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return Payment.findById(paymentId);
};

const verifyPayment = async (user, transactionId) => {
  const payment = await Payment.findOne({ transactionId, user: user._id });
  if (!payment) throw new PaymentError("Payment not found", 404);
  if (!OPEN_STATUSES.includes(payment.status)) return toPaymentDTO(payment);

  const txn = await getProvider().retrieve(transactionId);
  if (!txn) throw new PaymentError("Payment provider does not recognise this transaction", 502);

  const order = await Order.findOne({ _id: payment.order, user: user._id });
  const matches =
    order &&
    txn.orderId === String(order._id) &&
    txn.amount === order.totalAmount &&
    txn.amount === payment.amount &&
    txn.currency === payment.currency;
  if (!matches) {
    console.error(`Payment ${payment._id} failed verification: provider data does not match the order`);
    throw new PaymentError("Payment details do not match the order");
  }

  const context = { actor: user, source: AUDIT_SOURCE.API };
  if (txn.status === "succeeded") return toPaymentDTO(await settlePayment(payment._id, true, undefined, context));
  if (txn.status === "failed") return toPaymentDTO(await settlePayment(payment._id, false, undefined, context));

  if (txn.expiresAt <= new Date()) {
    const cancelled = await Payment.updateOne(
      { _id: payment._id, status: { $in: fromStates(PAYMENT_TRANSITIONS, PAYMENT_STATUS.CANCELLED) } },
      { status: PAYMENT_STATUS.CANCELLED },
    );
    if (cancelled.modifiedCount === 1) {
      await audit.record({
        actor: user,
        action: AUDIT_ACTION.PAYMENT_CANCELLED,
        entityType: AUDIT_ENTITY.PAYMENT,
        entityId: payment._id,
        order: payment.order,
        metadata: { reason: "Payment session expired" },
      });
    }
    return toPaymentDTO(await Payment.findById(payment._id));
  }

  return toPaymentDTO(payment);
};

const WEBHOOK_OUTCOMES = { "payment.succeeded": true, "payment.failed": false };

const handleWebhookEvent = async (event) => {
  if (!Object.hasOwn(WEBHOOK_OUTCOMES, event.type)) return;

  const { transactionId, orderId, amount, currency } = event.data || {};
  const payment = typeof transactionId === "string" ? await Payment.findOne({ transactionId }) : null;
  if (!payment) {
    console.error(`Webhook ${event.id}: no payment for transaction ${transactionId}`);
    return;
  }

  const matches =
    String(payment.order) === orderId && payment.amount === amount && payment.currency === currency;
  if (!matches) {
    console.error(`Webhook ${event.id}: event data does not match payment ${payment._id}`);
    return;
  }

  await settlePayment(payment._id, WEBHOOK_OUTCOMES[event.type], event.id, { source: AUDIT_SOURCE.WEBHOOK });
};

const simulateMockPayment = async (user, transactionId, outcome, deliverWebhook = true) => {
  if (process.env.PAYMENT_PROVIDER !== "mock") throw new PaymentError("Not found", 404);

  const payment = await Payment.findOne({ transactionId, user: user._id });
  if (!payment) throw new PaymentError("Payment not found", 404);

  const provider = getProvider();
  const delivery = await provider.simulateCustomerPayment(transactionId, outcome);
  if (!delivery) throw new PaymentError("This payment session is no longer open");

  if (deliverWebhook) {
    await handleWebhookEvent(provider.verifyWebhook(delivery.rawBody, delivery.signature));
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

const refundPayment = async (admin, paymentId, reason) => {
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
        { _id: payment._id, status: { $in: fromStates(PAYMENT_TRANSITIONS, PAYMENT_STATUS.REFUNDED) } },
        {
          status: PAYMENT_STATUS.REFUNDED,
          refundId,
          refundedAt: new Date(),
          refundReason: reason,
          refundedBy: admin._id,
        },
        { session },
      );
      if (!refunded) return;

      const orderBefore = await Order.findById(payment.order).session(session);
      await Order.updateOne(
        { _id: payment.order, paymentStatus: { $in: fromStates(ORDER_PAYMENT_TRANSITIONS, PAYMENT_STATUS.REFUNDED) } },
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
      let orderStatusAfter = orderBefore.status;
      if (items.length > 0) {
        await cancelItems(items, session);
        orderStatusAfter = await recomputeOrderStatus(payment.order, session);
      }

      await audit.record(
        {
          actor: admin,
          action: AUDIT_ACTION.PAYMENT_REFUNDED,
          entityType: AUDIT_ENTITY.PAYMENT,
          entityId: payment._id,
          order: payment.order,
          metadata: {
            amount: payment.amount,
            refundId,
            reason: reason || null,
            cancelledItems: items.length,
          },
        },
        session,
      );
      if (orderStatusAfter !== orderBefore.status) {
        await audit.record(
          {
            actor: admin,
            action: AUDIT_ACTION.ORDER_STATUS_CHANGED,
            entityType: AUDIT_ENTITY.ORDER,
            entityId: payment.order,
            order: payment.order,
            metadata: { orderStatusFrom: orderBefore.status, orderStatusTo: orderStatusAfter, reason: "Payment refunded" },
          },
          session,
        );
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

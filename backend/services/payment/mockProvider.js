const crypto = require("crypto");
const MockTransaction = require("../../models/MockTransaction");

const SESSION_MINUTES = 30;

const sign = (rawBody) =>
  crypto.createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex");

const toProviderTransaction = (txn) => ({
  transactionId: txn.transactionId,
  orderId: txn.orderId,
  amount: txn.amount,
  currency: txn.currency,
  status: txn.status,
  expiresAt: txn.expiresAt,
});

const createIntent = async ({ amount, currency, orderId }) => {
  const txn = await MockTransaction.create({
    transactionId: `mock_txn_${crypto.randomUUID()}`,
    orderId: String(orderId),
    amount,
    currency,
    expiresAt: new Date(Date.now() + SESSION_MINUTES * 60 * 1000),
  });
  return toProviderTransaction(txn);
};

const retrieve = async (transactionId) => {
  const txn = await MockTransaction.findOne({ transactionId });
  return txn ? toProviderTransaction(txn) : null;
};

const refund = async (transactionId) => {
  const txn = await MockTransaction.findOneAndUpdate(
    { transactionId, status: "succeeded" },
    { status: "refunded", refundId: `mock_re_${crypto.randomUUID()}` },
    { returnDocument: "after" },
  );
  if (!txn) {
    const err = new Error("This transaction cannot be refunded");
    err.statusCode = 400;
    throw err;
  }
  return { refundId: txn.refundId };
};

const verifyWebhook = (rawBody, signature) => {
  const expected = Buffer.from(sign(rawBody));
  const received = Buffer.from(String(signature || ""));
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    const err = new Error("Invalid webhook signature");
    err.statusCode = 400;
    throw err;
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    const err = new Error("Invalid webhook payload");
    err.statusCode = 400;
    throw err;
  }
};

// Stands in for "the customer typed their card on the provider's page".
const simulateCustomerPayment = async (transactionId, outcome) => {
  const txn = await MockTransaction.findOneAndUpdate(
    { transactionId, status: "requires_payment", expiresAt: { $gt: new Date() } },
    { status: outcome === "success" ? "succeeded" : "failed" },
    { returnDocument: "after" },
  );
  if (!txn) return null;

  const rawBody = JSON.stringify({
    id: `mock_evt_${crypto.randomUUID()}`,
    type: outcome === "success" ? "payment.succeeded" : "payment.failed",
    data: {
      transactionId: txn.transactionId,
      orderId: txn.orderId,
      amount: txn.amount,
      currency: txn.currency,
    },
  });
  return { rawBody, signature: sign(rawBody) };
};

module.exports = { createIntent, retrieve, refund, verifyWebhook, simulateCustomerPayment };

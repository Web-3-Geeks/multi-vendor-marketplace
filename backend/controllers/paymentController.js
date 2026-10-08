const {
  createPaymentForOrder,
  verifyPayment,
  handleWebhookEvent,
  simulateMockPayment,
} = require("../services/paymentService");

const { getProvider } = require("../services/payment");

const createPayment = async (req, res) => {
  const result = await createPaymentForOrder(req.user._id, req.body.orderId);
  res.status(201).json(result);
};

const verifyPaymentHandler = async (req, res) => {
  const payment = await verifyPayment(req.user._id, req.body.transactionId);
  res.json({ payment });
};

const webhookHandler = async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: "Invalid webhook payload" });
  }
  const rawBody = req.body.toString("utf8");
  const event = getProvider().verifyWebhook(rawBody, req.headers["x-payment-signature"]);
  await handleWebhookEvent(event);
  res.json({ received: true });
};

const simulatePaymentHandler = async (req, res) => {
  const { transactionId, outcome, deliverWebhook } = req.body;
  const payment = await simulateMockPayment(req.user._id, transactionId, outcome, deliverWebhook);
  res.json({ payment });
};


module.exports = { createPayment, verifyPaymentHandler, webhookHandler, simulatePaymentHandler };



const express = require("express");
const {
  createPayment,
  getOrderPayment,
  verifyPaymentHandler,
  webhookHandler,
  simulatePaymentHandler,
} = require("../controllers/paymentController");
const {
  createPaymentRules,
  verifyPaymentRules,
  simulatePaymentRules,
  orderPaymentRules,
} = require("../validators/paymentValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { paymentLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/webhook", webhookHandler);

router.get("/order/:orderId", authenticate, paymentLimiter, orderPaymentRules, validate, getOrderPayment);
router.post("/create", authenticate, paymentLimiter, createPaymentRules, validate, createPayment);
router.post("/verify", authenticate, paymentLimiter, verifyPaymentRules, validate, verifyPaymentHandler);
router.post("/mock/pay", authenticate, paymentLimiter, simulatePaymentRules, validate, simulatePaymentHandler);

module.exports = router;


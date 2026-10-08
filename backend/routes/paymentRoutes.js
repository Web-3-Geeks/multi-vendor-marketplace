const express = require("express");
const {
  createPayment,
  verifyPaymentHandler,
  webhookHandler,
  simulatePaymentHandler,
} = require("../controllers/paymentController");
const {
  createPaymentRules,
  verifyPaymentRules,
  simulatePaymentRules,
} = require("../validators/paymentValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.post("/webhook", webhookHandler);

router.post("/create", authenticate, createPaymentRules, validate, createPayment);
router.post("/verify", authenticate, verifyPaymentRules, validate, verifyPaymentHandler);
router.post("/mock/pay", authenticate, simulatePaymentRules, validate, simulatePaymentHandler);

module.exports = router;


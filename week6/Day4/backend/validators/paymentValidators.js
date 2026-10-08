const { body, param } = require("express-validator");

const createPaymentRules = [
  body("orderId").isMongoId().withMessage("A valid order ID is required"),
];

const verifyPaymentRules = [
  body("transactionId")
    .isString().withMessage("Transaction ID must be text").bail()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage("A valid transaction ID is required"),
];

const simulatePaymentRules = [
  body("transactionId")
    .isString().withMessage("Transaction ID must be text").bail()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage("A valid transaction ID is required"),
  body("outcome")
    .isIn(["success", "failure"]).withMessage("Outcome must be success or failure"),
  body("deliverWebhook")
    .optional()
    .isBoolean().withMessage("deliverWebhook must be true or false")
    .toBoolean(),
];


const orderPaymentRules = [param("orderId").isMongoId().withMessage("A valid order ID is required")];

module.exports = { createPaymentRules, verifyPaymentRules, simulatePaymentRules, orderPaymentRules };


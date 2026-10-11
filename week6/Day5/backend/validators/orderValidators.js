const { body } = require("express-validator");
const { ORDER_STATUS } = require("../constants/orderStatus");

const VENDOR_SETTABLE_STATUSES = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
];

const updateOrderStatusRules = [
  body("status")
    .isString().withMessage("Status must be text").bail()
    .isIn(VENDOR_SETTABLE_STATUSES)
    .withMessage(`Status must be one of: ${VENDOR_SETTABLE_STATUSES.join(", ")}`),
];

module.exports = { updateOrderStatusRules };

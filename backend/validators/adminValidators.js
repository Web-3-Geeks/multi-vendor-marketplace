const { body, param } = require("express-validator");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const { optionalQuery, paginationRules, dateRangeRules, searchRule } = require("./queryRules");

const idParamRule = param("id").isMongoId().withMessage("Invalid id");

const listPaymentsRules = [
  searchRule,
  optionalQuery("status")
    .isIn(Object.values(PAYMENT_STATUS))
    .withMessage(`Status must be one of: ${Object.values(PAYMENT_STATUS).join(", ")}`),
  ...dateRangeRules,
  ...paginationRules,
];

const paymentIdRules = [idParamRule];

const refundPaymentRules = [
  idParamRule,
  body("reason")
    .optional({ values: "null" })
    .isString().withMessage("Reason must be text").bail()
    .trim()
    .isLength({ max: 500 }).withMessage("Reason must be at most 500 characters"),
];

const listOrdersRules = [
  searchRule,
  optionalQuery("status")
    .isIn(Object.values(ORDER_STATUS))
    .withMessage(`Status must be one of: ${Object.values(ORDER_STATUS).join(", ")}`),
  optionalQuery("paymentStatus")
    .isIn(Object.values(PAYMENT_STATUS))
    .withMessage(`Payment status must be one of: ${Object.values(PAYMENT_STATUS).join(", ")}`),
  ...paginationRules,
];

const orderIdRules = [idParamRule];

const ADMIN_SETTABLE_ORDER_STATUSES = [
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
];

const updateAdminOrderStatusRules = [
  idParamRule,
  body("status")
    .isString().withMessage("Status must be text").bail()
    .isIn(ADMIN_SETTABLE_ORDER_STATUSES)
    .withMessage(`Status must be one of: ${ADMIN_SETTABLE_ORDER_STATUSES.join(", ")}`),
];

module.exports = {
  listPaymentsRules,
  paymentIdRules,
  refundPaymentRules,
  listOrdersRules,
  orderIdRules,
  updateAdminOrderStatusRules,
};

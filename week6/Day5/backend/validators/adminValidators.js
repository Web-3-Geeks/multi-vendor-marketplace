const { body, param } = require("express-validator");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const PRODUCT_STATUS = require("../constants/productStatus");
const { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_SOURCE } = require("../constants/audit");
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

const listAdminProductsRules = [
  searchRule,
  optionalQuery("status")
    .isIn(Object.values(PRODUCT_STATUS))
    .withMessage(`Status must be one of: ${Object.values(PRODUCT_STATUS).join(", ")}`),
  optionalQuery("vendor").isMongoId().withMessage("Vendor must be a valid id"),
  optionalQuery("category").isMongoId().withMessage("Category must be a valid id"),
  ...paginationRules,
];

const ADMIN_PRODUCT_STATUSES = [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.ARCHIVED];

const updateAdminProductStatusRules = [
  idParamRule,
  body("status")
    .isString().withMessage("Status must be text").bail()
    .isIn(ADMIN_PRODUCT_STATUSES)
    .withMessage(`Status must be one of: ${ADMIN_PRODUCT_STATUSES.join(", ")}`),
];

const listAuditLogsRules = [
  optionalQuery("entityType")
    .isIn(Object.values(AUDIT_ENTITY))
    .withMessage(`Entity type must be one of: ${Object.values(AUDIT_ENTITY).join(", ")}`),
  optionalQuery("entityId").isMongoId().withMessage("Entity id must be a valid id"),
  optionalQuery("orderId").isMongoId().withMessage("Order id must be a valid id"),
  optionalQuery("action")
    .isIn(Object.values(AUDIT_ACTION))
    .withMessage(`Action must be one of: ${Object.values(AUDIT_ACTION).join(", ")}`),
  optionalQuery("actor").isMongoId().withMessage("Actor must be a valid id"),
  optionalQuery("source")
    .isIn(Object.values(AUDIT_SOURCE))
    .withMessage(`Source must be one of: ${Object.values(AUDIT_SOURCE).join(", ")}`),
  ...dateRangeRules,
  ...paginationRules,
];

module.exports = {
  listAdminProductsRules,
  updateAdminProductStatusRules,
  listAuditLogsRules,
  listPaymentsRules,
  paymentIdRules,
  refundPaymentRules,
  listOrdersRules,
  orderIdRules,
  updateAdminOrderStatusRules,
};

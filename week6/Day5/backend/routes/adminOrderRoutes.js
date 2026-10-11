const express = require("express");
const { listOrders, getOrder, updateOrderStatus } = require("../controllers/adminOrderController");
const {
  listOrdersRules,
  orderIdRules,
  updateAdminOrderStatusRules,
} = require("../validators/adminValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get("/", listOrdersRules, validate, listOrders);
router.get("/:id", orderIdRules, validate, getOrder);
router.patch("/:id/status", updateAdminOrderStatusRules, validate, updateOrderStatus);

module.exports = router;

const express = require("express");
const {
  listVendorOrders,
  getVendorOrder,
  updateVendorOrderStatus,
} = require("../controllers/vendorOrderController");
const { updateOrderStatusRules } = require("../validators/orderValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const loadVendor = require("../middleware/loadVendor");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.VENDOR), loadVendor);

router.get("/", listVendorOrders);
router.get("/:id", getVendorOrder);
router.patch("/:id/status", updateOrderStatusRules, validate, updateVendorOrderStatus);

module.exports = router;

const express = require("express");
const { listVendors, getVendorById, updateVendorStatus } = require("../controllers/adminVendorController");
const { updateVendorStatusRules } = require("../validators/adminVendorValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get("/", listVendors);
router.get("/:id", getVendorById);
router.patch("/:id/status", updateVendorStatusRules, validate, updateVendorStatus);

module.exports = router;

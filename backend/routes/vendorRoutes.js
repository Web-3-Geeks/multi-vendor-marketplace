const express = require("express");
const {
  applyAsVendor,
  getMyApplication,
  listPublicVendors,
  getPublicVendor,
} = require("../controllers/vendorController");
const { applyVendorRules } = require("../validators/vendorValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.get("/", listPublicVendors);
router.get("/me", authenticate, getMyApplication);
router.get("/:id", getPublicVendor);
router.post("/", authenticate, requireRole(ROLES.CUSTOMER), applyVendorRules, validate, applyAsVendor);

module.exports = router;

const express = require("express");
const { getEarnings } = require("../controllers/vendorEarningsController");
const { listEarningsRules } = require("../validators/earningsValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const loadVendor = require("../middleware/loadVendor");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.VENDOR), loadVendor);

router.get("/", listEarningsRules, validate, getEarnings);

module.exports = router;

const express = require("express");
const { listProducts, updateProductStatus } = require("../controllers/adminProductController");
const { listAdminProductsRules, updateAdminProductStatusRules } = require("../validators/adminValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get("/", listAdminProductsRules, validate, listProducts);
router.patch("/:id/status", updateAdminProductStatusRules, validate, updateProductStatus);

module.exports = router;

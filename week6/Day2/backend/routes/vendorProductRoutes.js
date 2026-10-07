const express = require("express");
const {
  createProduct,
  listMyProducts,
  getMyProduct,
  updateMyProduct,
  archiveMyProduct,
} = require("../controllers/vendorProductController");
const {
  createProductRules,
  updateProductRules,
  listProductQueryRules,
} = require("../validators/productValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const loadVendor = require("../middleware/loadVendor");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.VENDOR), loadVendor);

router.post("/", createProductRules, validate, createProduct);
router.get("/", listProductQueryRules, validate, listMyProducts);
router.get("/:id", getMyProduct);
router.patch("/:id", updateProductRules, validate, updateMyProduct);
router.delete("/:id", archiveMyProduct);

module.exports = router;

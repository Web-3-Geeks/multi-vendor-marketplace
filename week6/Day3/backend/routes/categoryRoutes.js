const express = require("express");
const {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { createCategoryRules, updateCategoryRules } = require("../validators/categoryValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.get("/", listCategories);
router.post("/", authenticate, requireRole(ROLES.ADMIN), createCategoryRules, validate, createCategory);
router.patch("/:id", authenticate, requireRole(ROLES.ADMIN), updateCategoryRules, validate, updateCategory);
router.delete("/:id", authenticate, requireRole(ROLES.ADMIN), deleteCategory);

module.exports = router;

const express = require("express");
const { listProducts, getProduct } = require("../controllers/publicProductController");
const { publicProductQueryRules } = require("../validators/productValidators");
const validate = require("../middleware/validate");

const router = express.Router();

router.get("/", publicProductQueryRules, validate, listProducts);
router.get("/:id", getProduct);

module.exports = router;

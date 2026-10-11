const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { checkoutRules } = require("../validators/checkoutValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.post("/", authenticate, checkoutRules, validate, checkout);

module.exports = router;

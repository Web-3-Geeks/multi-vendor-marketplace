const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { checkoutRules } = require("../validators/checkoutValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { checkoutLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", authenticate, checkoutLimiter, checkoutRules, validate, checkout);

module.exports = router;

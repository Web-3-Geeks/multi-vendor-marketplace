const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, checkout);

module.exports = router;

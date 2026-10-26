const express = require("express");
const { listMyOrders, getMyOrder } = require("../controllers/orderController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { paginationRules } = require("../validators/queryRules");

const router = express.Router();

router.use(authenticate);

router.get("/", paginationRules, validate, listMyOrders);
router.get("/:id", getMyOrder);

module.exports = router;

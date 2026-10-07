const express = require("express");
const { listMyOrders, getMyOrder } = require("../controllers/orderController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/", listMyOrders);
router.get("/:id", getMyOrder);

module.exports = router;

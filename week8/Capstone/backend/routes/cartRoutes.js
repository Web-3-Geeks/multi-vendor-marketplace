const express = require("express");
const { getCart, addCartItem, updateCartItem, removeCartItem } = require("../controllers/cartController");
const { addCartItemRules, updateCartItemRules } = require("../validators/cartValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

// Any authenticated user can shop -- customers, vendors and admins alike
// (Day 1's RBAC table allows "Place orders" for all three roles).
router.use(authenticate);

router.get("/", getCart);
router.post("/items", addCartItemRules, validate, addCartItem);
router.patch("/items/:id", updateCartItemRules, validate, updateCartItem);
router.delete("/items/:id", removeCartItem);

module.exports = router;

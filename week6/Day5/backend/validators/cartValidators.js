const { body } = require("express-validator");

const addCartItemRules = [
  body("productId").isMongoId().withMessage("productId must be a valid id"),
  body("quantity")
    .isInt({ min: 1, max: 10000 })
    .withMessage("Quantity must be a whole number, at least 1")
    .toInt(),
];

const updateCartItemRules = [
  body("quantity")
    .isInt({ min: 1, max: 10000 })
    .withMessage("Quantity must be a whole number, at least 1")
    .toInt(),
];

module.exports = { addCartItemRules, updateCartItemRules };

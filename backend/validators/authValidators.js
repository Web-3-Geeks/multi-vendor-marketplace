const { body } = require("express-validator");

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Za-z]/)
    .withMessage("Password must contain a letter")
    .matches(/\d/)
    .withMessage("Password must contain a number"),
];

const loginRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .bail()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

module.exports = { registerRules, loginRules };

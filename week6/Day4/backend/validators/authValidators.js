const { body } = require("express-validator");

const registerRules = [
  body("name")
    .isString().withMessage("Name must be text").bail()
    .trim()
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ max: 100 }).withMessage("Name must be at most 100 characters"),
  body("email")
    .isString().withMessage("Email must be text").bail()
    .trim()
    .notEmpty().withMessage("Email is required").bail()
    .isLength({ max: 254 }).withMessage("Email is too long").bail()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .isString().withMessage("Password must be text").bail()
    .isLength({ min: 8, max: 72 }).withMessage("Password must be 8 to 72 characters")
    .matches(/[A-Za-z]/).withMessage("Password must contain a letter")
    .matches(/\d/).withMessage("Password must contain a number"),
];

const loginRules = [
  body("email")
    .isString().withMessage("Email must be text").bail()
    .trim()
    .notEmpty().withMessage("Email is required").bail()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .isString().withMessage("Password must be text").bail()
    .notEmpty().withMessage("Password is required"),
];

module.exports = { registerRules, loginRules };

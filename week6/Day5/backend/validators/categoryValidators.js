const { body } = require("express-validator");

const createCategoryRules = [
  body("name")
    .isString().withMessage("Name must be text").bail()
    .trim()
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ max: 100 }).withMessage("Name must be at most 100 characters"),
  body("description")
    .optional({ values: "falsy" })
    .isString().withMessage("Description must be text")
    .isLength({ max: 500 }).withMessage("Description must be at most 500 characters"),
];

const updateCategoryRules = [
  body("name")
    .optional()
    .isString().withMessage("Name must be text").bail()
    .trim()
    .notEmpty().withMessage("Name cannot be empty").bail()
    .isLength({ max: 100 }).withMessage("Name must be at most 100 characters"),
  body("description")
    .optional({ values: "falsy" })
    .isString().withMessage("Description must be text")
    .isLength({ max: 500 }).withMessage("Description must be at most 500 characters"),
];

module.exports = { createCategoryRules, updateCategoryRules };

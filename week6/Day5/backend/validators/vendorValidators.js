const { body } = require("express-validator");

const applyVendorRules = [
  body("storeName")
    .isString().withMessage("Store name must be text").bail()
    .trim()
    .notEmpty().withMessage("Store name is required").bail()
    .isLength({ max: 100 }).withMessage("Store name must be at most 100 characters"),
  body("storeDescription")
    .isString().withMessage("Store description must be text").bail()
    .trim()
    .notEmpty().withMessage("Store description is required").bail()
    .isLength({ max: 1000 }).withMessage("Store description must be at most 1000 characters"),
  body("logo")
    .optional({ values: "falsy" })
    .isString().withMessage("Logo must be text")
    .isURL().withMessage("Logo must be a valid URL"),
];

module.exports = { applyVendorRules };

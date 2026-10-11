const { query } = require("express-validator");

const optionalQuery = (name) => query(name).optional({ values: "falsy" });

const paginationRules = [
  optionalQuery("page")
    .isInt({ min: 1, max: 10000 }).withMessage("Page must be a whole number, 1 or more")
    .toInt(),
  optionalQuery("limit")
    .isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50")
    .toInt(),
];

const dateRangeRules = [
  optionalQuery("from").isISO8601().withMessage("from must be a valid date"),
  optionalQuery("to").isISO8601().withMessage("to must be a valid date"),
];

const searchRule = optionalQuery("search")
  .isString().withMessage("Search must be text").bail()
  .trim()
  .isLength({ max: 100 }).withMessage("Search must be at most 100 characters");

module.exports = { optionalQuery, paginationRules, dateRangeRules, searchRule };

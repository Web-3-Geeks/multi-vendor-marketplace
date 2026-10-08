const { body, query } = require("express-validator");
const PRODUCT_STATUS = require("../constants/productStatus");

const VENDOR_SETTABLE_STATUSES = [
  PRODUCT_STATUS.DRAFT,
  PRODUCT_STATUS.ACTIVE,
  PRODUCT_STATUS.ARCHIVED,
];

const field = (name, partial) => (partial ? body(name).optional() : body(name));

const productRules = (partial) => [
  field("name", partial)
    .isString().withMessage("Name must be text").bail()
    .trim()
    .notEmpty().withMessage("Name is required").bail()
    .isLength({ max: 150 }).withMessage("Name must be at most 150 characters"),
  body("description")
    .optional({ values: "null" })
    .isString().withMessage("Description must be text").bail()
    .trim()
    .isLength({ max: 2000 }).withMessage("Description must be at most 2000 characters"),
  field("price", partial)
    .isFloat({ gt: 0, max: 10000000 }).withMessage("Price must be a number greater than zero")
    .toFloat(),
  field("stock", partial)
    .isInt({ min: 0, max: 1000000 }).withMessage("Stock must be a whole number, 0 or more")
    .toInt(),
  field("category", partial)
    .isMongoId().withMessage("Category must be a valid id"),
  body("images")
    .optional()
    .isArray({ max: 5 }).withMessage("Images must be a list of at most 5 URLs"),
  body("images.*")
    .isString().withMessage("Each image must be a URL").bail()
    .isURL().withMessage("Each image must be a valid URL"),
  body("status")
    .optional()
    .isIn(VENDOR_SETTABLE_STATUSES)
    .withMessage("Status must be DRAFT, ACTIVE or ARCHIVED"),
];

const createProductRules = productRules(false);
const updateProductRules = productRules(true);

const listProductQueryRules = [
  query("status")
    .optional()
    .isIn(Object.values(PRODUCT_STATUS))
    .withMessage("Invalid status filter"),
];

const PUBLIC_SORTS = ["newest", "price_asc", "price_desc"];

const optionalQuery = (name) => query(name).optional({ values: "falsy" });

const publicProductQueryRules = [
  optionalQuery("search")
    .isString().withMessage("Search must be text").bail()
    .trim()
    .isLength({ max: 100 }).withMessage("Search must be at most 100 characters"),
  optionalQuery("category")
    .isString().withMessage("Category must be text").bail()
    .trim()
    .isLength({ max: 100 }).withMessage("Category is too long"),
  optionalQuery("vendor").isMongoId().withMessage("Vendor must be a valid id"),
  optionalQuery("minPrice")
    .isFloat({ min: 0 }).withMessage("minPrice must be a number, 0 or more")
    .toFloat(),
  optionalQuery("maxPrice")
    .isFloat({ min: 0 }).withMessage("maxPrice must be a number, 0 or more").bail()
    .toFloat()
    .custom((max, { req }) => {
      const min = Number(req.query.minPrice);
      if (req.query.minPrice && !Number.isNaN(min) && min > max) {
        throw new Error("maxPrice must be greater than or equal to minPrice");
      }
      return true;
    }),
  optionalQuery("sort")
    .isIn(PUBLIC_SORTS).withMessage("Sort must be newest, price_asc or price_desc"),
  optionalQuery("page")
    .isInt({ min: 1, max: 10000 }).withMessage("Page must be a whole number, 1 or more")
    .toInt(),
  optionalQuery("limit")
    .isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50")
    .toInt(),
];

module.exports = {
  createProductRules,
  updateProductRules,
  listProductQueryRules,
  publicProductQueryRules,
};

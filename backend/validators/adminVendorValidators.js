const { body } = require("express-validator");
const VENDOR_STATUS = require("../constants/vendorStatus");
const { optionalQuery, paginationRules, searchRule } = require("./queryRules");

const updateVendorStatusRules = [
  body("status")
    .isString().withMessage("Status must be text").bail()
    .isIn([VENDOR_STATUS.APPROVED, VENDOR_STATUS.REJECTED, VENDOR_STATUS.SUSPENDED])
    .withMessage("Status must be APPROVED, REJECTED, or SUSPENDED"),
];

const listVendorsRules = [
  optionalQuery("status")
    .isIn(Object.values(VENDOR_STATUS))
    .withMessage("Invalid status filter"),
  searchRule,
  ...paginationRules,
];

module.exports = { updateVendorStatusRules, listVendorsRules };

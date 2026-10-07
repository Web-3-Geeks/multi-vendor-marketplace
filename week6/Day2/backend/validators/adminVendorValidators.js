const { body } = require("express-validator");
const VENDOR_STATUS = require("../constants/vendorStatus");

const updateVendorStatusRules = [
  body("status")
    .isString().withMessage("Status must be text").bail()
    .isIn([VENDOR_STATUS.APPROVED, VENDOR_STATUS.REJECTED, VENDOR_STATUS.SUSPENDED])
    .withMessage("Status must be APPROVED, REJECTED, or SUSPENDED"),
];

module.exports = { updateVendorStatusRules };

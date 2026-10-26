const { body } = require("express-validator");

const text = (path, label, { max, optional = false } = {}) => {
  const chain = body(`shippingAddress.${path}`);
  if (optional) chain.optional({ values: "falsy" });
  return chain
    .isString().withMessage(`${label} must be text`).bail()
    .trim()
    .notEmpty().withMessage(`${label} is required`).bail()
    .isLength({ max }).withMessage(`${label} must be at most ${max} characters`);
};

const checkoutRules = [
  body("shippingAddress")
    .isObject().withMessage("A shipping address is required"),
  text("fullName", "Full name", { max: 100 }),
  text("phone", "Phone number", { max: 20 })
    .matches(/^[0-9+()\-\s]{7,20}$/).withMessage("Enter a valid phone number"),
  text("line1", "Address", { max: 200 }),
  text("line2", "Address line 2", { max: 200, optional: true }),
  text("city", "City", { max: 100 }),
  text("state", "State or region", { max: 100, optional: true }),
  text("postalCode", "Postal code", { max: 12 })
    .matches(/^[A-Za-z0-9\s-]{3,12}$/).withMessage("Enter a valid postal code"),
  text("country", "Country", { max: 100 }),
];

module.exports = { checkoutRules };

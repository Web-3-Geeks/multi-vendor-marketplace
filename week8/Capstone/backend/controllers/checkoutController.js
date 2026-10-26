const { createOrderFromCart, CheckoutError } = require("../services/orderService");

const ADDRESS_FIELDS = ["fullName", "phone", "line1", "line2", "city", "state", "postalCode", "country"];

// Only the known address fields are copied from the request body.
const pickAddress = (input) =>
  Object.fromEntries(ADDRESS_FIELDS.filter((key) => input[key]).map((key) => [key, input[key]]));

const checkout = async (req, res) => {
  try {
    const order = await createOrderFromCart(req.user._id, pickAddress(req.body.shippingAddress));
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(err.statusCode).json({ message: err.message, errors: err.errors });
    }
    throw err;
  }
};

module.exports = { checkout };

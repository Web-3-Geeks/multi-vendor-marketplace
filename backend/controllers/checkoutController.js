const { createOrderFromCart, CheckoutError } = require("../services/orderService");

const checkout = async (req, res) => {
  try {
    const order = await createOrderFromCart(req.user._id);
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(err.statusCode).json({ message: err.message, errors: err.errors });
    }
    throw err;
  }
};

module.exports = { checkout };

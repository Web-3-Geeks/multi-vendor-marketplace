const { listOrdersForUser, getOrderForUser } = require("../services/orderService");

const listMyOrders = async (req, res) => {
  const orders = await listOrdersForUser(req.user._id);
  res.json({ orders });
};

const getMyOrder = async (req, res) => {
  const order = await getOrderForUser(req.params.id, req.user._id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  res.json({ order });
};

module.exports = { listMyOrders, getMyOrder };

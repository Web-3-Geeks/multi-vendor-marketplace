const { matchedData } = require("express-validator");
const { listOrdersForUser, getOrderForUser } = require("../services/orderService");
const { pageParams } = require("../utils/pagination");

const listMyOrders = async (req, res) => {
  const query = matchedData(req, { locations: ["query"] });
  res.json(await listOrdersForUser(req.user._id, pageParams(query, 10)));
};

const getMyOrder = async (req, res) => {
  const order = await getOrderForUser(req.params.id, req.user._id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }
  res.json({ order });
};

module.exports = { listMyOrders, getMyOrder };

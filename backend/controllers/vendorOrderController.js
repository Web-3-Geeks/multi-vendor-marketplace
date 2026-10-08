const OrderItem = require("../models/OrderItem");
const { round2, updateItemsStatus } = require("../services/orderService");

// Groups this vendor's order items by order, with a subtotal computed only
// from their own items -- never the whole (possibly multi-vendor) order total.
const groupByOrder = (items) => {
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.order._id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        orderId: item.order._id,
        orderStatus: item.order.status,
        paymentStatus: item.order.paymentStatus,
        orderCreatedAt: item.order.createdAt,
        items: [],
        vendorSubtotal: 0,
      });
    }
    const group = grouped.get(key);
    group.items.push({
      id: item._id,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      status: item.status,
    });
    group.vendorSubtotal = round2(group.vendorSubtotal + item.subtotal);
  }
  return Array.from(grouped.values());
};

const listVendorOrders = async (req, res) => {
  const items = await OrderItem.find({ vendor: req.vendor._id })
    .populate("order", "status paymentStatus createdAt")
    .sort({ createdAt: -1 });

  res.json({ orders: groupByOrder(items) });
};

const getVendorOrder = async (req, res) => {
  const items = await OrderItem.find({ vendor: req.vendor._id, order: req.params.id }).populate(
    "order",
    "status paymentStatus createdAt",
  );

  if (items.length === 0) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({ order: groupByOrder(items)[0] });
};

const updateVendorOrderStatus = async (req, res) => {
  const { status } = req.body;

  await updateItemsStatus(req.params.id, status, { vendorId: req.vendor._id });

  const updated = await OrderItem.find({ vendor: req.vendor._id, order: req.params.id }).populate(
    "order",
    "status paymentStatus createdAt",
  );
  res.json({ order: groupByOrder(updated)[0] });
};

module.exports = { listVendorOrders, getVendorOrder, updateVendorOrderStatus };

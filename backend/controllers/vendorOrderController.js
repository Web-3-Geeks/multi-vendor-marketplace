const { matchedData } = require("express-validator");
const OrderItem = require("../models/OrderItem");
const { pageParams, pageInfo } = require("../utils/pagination");
const { round2, updateItemsStatus, toShippingAddressDTO } = require("../services/orderService");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");

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
        // A customer's address is only shared with vendors once the order is paid.
        shippingAddress:
          item.order.paymentStatus === PAYMENT_STATUS.PAID
            ? toShippingAddressDTO(item.order.shippingAddress) || null
            : null,
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

// Pages are made of whole orders (newest first), not of loose items, so an order is
// never split across two pages.
const listVendorOrders = async (req, res) => {
  const query = matchedData(req, { locations: ["query"] });
  const { page, limit, skip } = pageParams(query, 10);

  const [paged] = await OrderItem.aggregate([
    { $match: { vendor: req.vendor._id } },
    { $group: { _id: "$order", latest: { $max: "$createdAt" } } },
    { $sort: { latest: -1, _id: -1 } },
    { $facet: { ids: [{ $skip: skip }, { $limit: limit }], total: [{ $count: "count" }] } },
  ]);

  const items = await OrderItem.find({
    vendor: req.vendor._id,
    order: { $in: paged.ids.map((entry) => entry._id) },
  })
    .populate("order", "status paymentStatus shippingAddress createdAt")
    .sort({ createdAt: -1 });

  res.json({
    orders: groupByOrder(items),
    pagination: pageInfo(page, limit, paged.total[0]?.count || 0),
  });
};

const getVendorOrder = async (req, res) => {
  const items = await OrderItem.find({ vendor: req.vendor._id, order: req.params.id }).populate(
    "order",
    "status paymentStatus shippingAddress createdAt",
  );

  if (items.length === 0) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({ order: groupByOrder(items)[0] });
};

const updateVendorOrderStatus = async (req, res) => {
  const { status } = req.body;

  await updateItemsStatus(req.params.id, status, { vendorId: req.vendor._id, actor: req.user });

  const updated = await OrderItem.find({ vendor: req.vendor._id, order: req.params.id }).populate(
    "order",
    "status paymentStatus shippingAddress createdAt",
  );
  res.json({ order: groupByOrder(updated)[0] });
};

module.exports = { listVendorOrders, getVendorOrder, updateVendorOrderStatus };

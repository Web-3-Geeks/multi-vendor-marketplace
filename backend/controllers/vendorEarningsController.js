const { matchedData } = require("express-validator");
const Commission = require("../models/Commission");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const buildDateRange = require("../utils/dateRange");
const { round2 } = require("../utils/money");

const DEFAULT_LIMIT = 20;

const sumFor = (status) => ({
  $sum: { $cond: [{ $eq: ["$status", status] }, "$vendorAmount", 0] },
});

// Summary only counts earned money (PENDING + PAID). Cancelled and refunded
// commissions still show in the transaction list but never in the totals.
const getSummary = async (vendorId) => {
  const [row] = await Commission.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: { $in: [COMMISSION_STATUS.PENDING, COMMISSION_STATUS.PAID] },
      },
    },
    {
      $group: {
        _id: null,
        salesCount: { $sum: 1 },
        totalSales: { $sum: "$grossAmount" },
        totalCommission: { $sum: "$commissionAmount" },
        netEarnings: { $sum: "$vendorAmount" },
        paidEarnings: sumFor(COMMISSION_STATUS.PAID),
        pendingEarnings: sumFor(COMMISSION_STATUS.PENDING),
      },
    },
  ]);

  const value = (key) => round2(row?.[key] || 0);
  return {
    salesCount: row?.salesCount || 0,
    totalSales: value("totalSales"),
    totalCommission: value("totalCommission"),
    netEarnings: value("netEarnings"),
    paidEarnings: value("paidEarnings"),
    pendingEarnings: value("pendingEarnings"),
  };
};

const getEarnings = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  const filter = { vendor: req.vendor._id };
  if (q.status) filter.status = q.status;
  const createdAt = buildDateRange(q.from, q.to);
  if (createdAt) filter.createdAt = createdAt;

  const [summary, commissions, total] = await Promise.all([
    getSummary(req.vendor._id),
    Commission.find(filter)
      .populate("orderItem", "productName quantity unitPrice")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Commission.countDocuments(filter),
  ]);

  res.json({
    summary,
    transactions: commissions.map((c) => ({
      id: c._id,
      orderId: c.order,
      orderItemId: c.orderItem?._id,
      productName: c.orderItem?.productName,
      quantity: c.orderItem?.quantity,
      grossAmount: c.grossAmount,
      commissionRate: c.commissionRate,
      commissionAmount: c.commissionAmount,
      vendorAmount: c.vendorAmount,
      status: c.status,
      createdAt: c.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

module.exports = { getEarnings };

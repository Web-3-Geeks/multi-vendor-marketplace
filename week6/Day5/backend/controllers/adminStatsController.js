const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { round2 } = require("../utils/money");
const { cancelStaleUnpaidOrders } = require("../services/orderService");

const EARNED = [COMMISSION_STATUS.PENDING, COMMISSION_STATUS.PAID];

const getStats = async (req, res) => {
  await cancelStaleUnpaidOrders();

  const [totalOrders, paidOrders, pendingPayments, failedPayments, refundedPayments, sales, commissions] =
    await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ paymentStatus: PAYMENT_STATUS.PAID }),
      Order.countDocuments({
        paymentStatus: PAYMENT_STATUS.PENDING,
        status: { $ne: ORDER_STATUS.CANCELLED },
      }),
      Order.countDocuments({ paymentStatus: PAYMENT_STATUS.FAILED }),
      Payment.countDocuments({ status: PAYMENT_STATUS.REFUNDED }),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Commission.aggregate([
        { $match: { status: { $in: EARNED } } },
        {
          $group: {
            _id: null,
            commission: { $sum: "$commissionAmount" },
            vendorEarnings: { $sum: "$vendorAmount" },
          },
        },
      ]),
    ]);

  res.json({
    stats: {
      totalOrders,
      paidOrders,
      pendingPayments,
      failedPayments,
      refundedPayments,
      totalSales: round2(sales[0]?.total || 0),
      totalCommission: round2(commissions[0]?.commission || 0),
      vendorEarnings: round2(commissions[0]?.vendorEarnings || 0),
    },
  });
};

module.exports = { getStats };

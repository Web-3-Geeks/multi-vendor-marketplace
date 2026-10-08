const Commission = require("../models/Commission");
const OrderItem = require("../models/OrderItem");
const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { ORDER_STATUS } = require("../constants/orderStatus");
const { round2 } = require("../utils/money");

const DEFAULT_RATE = 0.1;

const getCommissionRate = () => {
  const rate = Number(process.env.COMMISSION_RATE || DEFAULT_RATE);
  if (!(rate >= 0 && rate <= 1)) {
    throw new Error("COMMISSION_RATE must be a number between 0 and 1");
  }
  return rate;
};

const createCommissionsForOrder = async (orderId, session) => {
  const items = await OrderItem.find({
    order: orderId,
    status: { $ne: ORDER_STATUS.CANCELLED },
  }).session(session);
  if (items.length === 0) return;

  const rate = getCommissionRate();
  await Commission.insertMany(
    items.map((item) => {
      const commissionAmount = round2(item.subtotal * rate);
      return {
        order: orderId,
        orderItem: item._id,
        vendor: item.vendor,
        grossAmount: item.subtotal,
        commissionRate: rate,
        commissionAmount,
        vendorAmount: round2(item.subtotal - commissionAmount),
      };
    }),
    { session },
  );
};

const setCommissionStatus = (filter, status, session, from = [COMMISSION_STATUS.PENDING]) =>
  Commission.updateMany({ ...filter, status: { $in: from } }, { status }, { session });

module.exports = { getCommissionRate, createCommissionsForOrder, setCommissionStatus };

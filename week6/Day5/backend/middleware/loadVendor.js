const Vendor = require("../models/Vendor");
const VENDOR_STATUS = require("../constants/vendorStatus");

const loadVendor = async (req, res, next) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor || vendor.status !== VENDOR_STATUS.APPROVED) {
    return res.status(403).json({ message: "Only approved vendors can manage products" });
  }
  req.vendor = vendor;
  next();
};

module.exports = loadVendor;

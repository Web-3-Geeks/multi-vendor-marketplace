const Vendor = require("../models/Vendor");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const VENDOR_STATUS = require("../constants/vendorStatus");

const listVendors = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const vendors = await Vendor.find(filter)
    .populate("user", "name email role")
    .sort({ createdAt: -1 });

  res.json({ vendors });
};

const getVendorById = async (req, res) => {
  const vendor = await Vendor.findById(req.params.id).populate("user", "name email role");
  if (!vendor) {
    return res.status(404).json({ message: "Vendor application not found" });
  }
  res.json({ vendor });
};

const updateVendorStatus = async (req, res) => {
  const { status } = req.body;

  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) {
    return res.status(404).json({ message: "Vendor application not found" });
  }

  vendor.status = status;
  await vendor.save();

  // SUSPENDED keeps the VENDOR role so the vendor can still log in and see why
  // they're restricted. Only REJECTED (never approved) drops back to CUSTOMER.
  // Either way, loadVendor blocks product management unless status is APPROVED.
  const keepsVendorRole = status === VENDOR_STATUS.APPROVED || status === VENDOR_STATUS.SUSPENDED;
  const newRole = keepsVendorRole ? ROLES.VENDOR : ROLES.CUSTOMER;
  await User.findByIdAndUpdate(vendor.user, { role: newRole });

  res.json({ vendor });
};

module.exports = { listVendors, getVendorById, updateVendorStatus };

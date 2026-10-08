const Vendor = require("../models/Vendor");
const VENDOR_STATUS = require("../constants/vendorStatus");

const toVendorResponse = (vendor) => ({
  id: vendor._id,
  storeName: vendor.storeName,
  storeDescription: vendor.storeDescription,
  logo: vendor.logo,
  status: vendor.status,
  createdAt: vendor.createdAt,
});

const toPublicVendor = (vendor) => ({
  id: vendor._id,
  storeName: vendor.storeName,
  storeDescription: vendor.storeDescription,
  logo: vendor.logo,
  createdAt: vendor.createdAt,
});

const applyAsVendor = async (req, res) => {
  const { storeName, storeDescription, logo } = req.body;

  const existing = await Vendor.findOne({ user: req.user._id });
  if (existing) {
    return res.status(409).json({ message: "You have already submitted a vendor application" });
  }

  const vendor = await Vendor.create({
    user: req.user._id,
    storeName,
    storeDescription,
    logo,
  });

  res.status(201).json({ vendor: toVendorResponse(vendor) });
};

const getMyApplication = async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  res.json({ vendor: vendor ? toVendorResponse(vendor) : null });
};

const listPublicVendors = async (req, res) => {
  const vendors = await Vendor.find({ status: VENDOR_STATUS.APPROVED }).sort({ storeName: 1 });
  res.json({ vendors: vendors.map(toPublicVendor) });
};

const getPublicVendor = async (req, res) => {
  const vendor = await Vendor.findOne({ _id: req.params.id, status: VENDOR_STATUS.APPROVED });
  if (!vendor) {
    return res.status(404).json({ message: "Store not found" });
  }
  res.json({ vendor: toPublicVendor(vendor) });
};

module.exports = { applyAsVendor, getMyApplication, listPublicVendors, getPublicVendor };

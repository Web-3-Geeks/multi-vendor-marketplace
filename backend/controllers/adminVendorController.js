const { matchedData } = require("express-validator");
const Vendor = require("../models/Vendor");
const escapeRegex = require("../utils/escapeRegex");
const { pageParams, pageInfo } = require("../utils/pagination");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const VENDOR_STATUS = require("../constants/vendorStatus");
const { AUDIT_ACTION, AUDIT_ENTITY } = require("../constants/audit");
const audit = require("../services/auditService");

const listVendors = async (req, res) => {
  const query = matchedData(req, { locations: ["query"] });
  const { page, limit, skip } = pageParams(query);

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.search) filter.storeName = new RegExp(escapeRegex(query.search), "i");

  const [vendors, total] = await Promise.all([
    Vendor.find(filter).populate("user", "name email role").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Vendor.countDocuments(filter),
  ]);

  res.json({ vendors, pagination: pageInfo(page, limit, total) });
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

  const previousStatus = vendor.status;
  vendor.status = status;
  await vendor.save();
  await audit.record({
    actor: req.user,
    action: AUDIT_ACTION.VENDOR_STATUS_CHANGED,
    entityType: AUDIT_ENTITY.VENDOR,
    entityId: vendor._id,
    metadata: { storeName: vendor.storeName, from: previousStatus, to: status },
  });

  // SUSPENDED keeps the VENDOR role so the vendor can still log in and see why
  // they're restricted. Only REJECTED (never approved) drops back to CUSTOMER.
  // Either way, loadVendor blocks product management unless status is APPROVED.
  const keepsVendorRole = status === VENDOR_STATUS.APPROVED || status === VENDOR_STATUS.SUSPENDED;
  const newRole = keepsVendorRole ? ROLES.VENDOR : ROLES.CUSTOMER;
  await User.findByIdAndUpdate(vendor.user, { role: newRole });

  res.json({ vendor });
};

module.exports = { listVendors, getVendorById, updateVendorStatus };

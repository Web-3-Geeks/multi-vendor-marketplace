const { matchedData } = require("express-validator");
const Product = require("../models/Product");
const PRODUCT_STATUS = require("../constants/productStatus");
const VENDOR_STATUS = require("../constants/vendorStatus");
const { AUDIT_ACTION, AUDIT_ENTITY } = require("../constants/audit");
const audit = require("../services/auditService");
const escapeRegex = require("../utils/escapeRegex");
const { publishErrors } = require("../utils/productRules");

const DEFAULT_LIMIT = 20;

const toAdminProductDTO = (product) => ({
  id: product._id,
  name: product.name,
  slug: product.slug,
  price: product.price,
  stock: product.stock,
  status: product.status,
  image: product.images?.[0] || null,
  takenDownByAdmin: Boolean(product.takenDownByAdmin),
  createdAt: product.createdAt,
  vendor: product.vendor && {
    id: product.vendor._id,
    storeName: product.vendor.storeName,
    status: product.vendor.status,
  },
  category: product.category && { id: product.category._id, name: product.category.name },
});

const populateProduct = (query) =>
  query.populate("vendor", "storeName status").populate("category", "name");

const listProducts = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.vendor) filter.vendor = q.vendor;
  if (q.category) filter.category = q.category;
  if (q.search) filter.name = new RegExp(escapeRegex(q.search), "i");

  const [products, total] = await Promise.all([
    populateProduct(Product.find(filter))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    products: products.map(toAdminProductDTO),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

// Moderation: an admin can take any product off the marketplace (ARCHIVED) or put it
// back (ACTIVE), under the same publishing rules a vendor has to follow.
const updateProductStatus = async (req, res) => {
  const { status } = req.body;

  const product = await populateProduct(Product.findById(req.params.id));
  if (!product) return res.status(404).json({ message: "Product not found" });

  const previousStatus = product.status;
  const wasTakenDown = Boolean(product.takenDownByAdmin);
  if (status === PRODUCT_STATUS.ACTIVE) {
    if (product.vendor?.status !== VENDOR_STATUS.APPROVED) {
      return res.status(400).json({ message: "The vendor of this product is not approved" });
    }
    const errors = publishErrors(product);
    if (errors.length) {
      return res.status(400).json({ message: "Product cannot be published", errors });
    }
  }

  product.status = status;
  product.takenDownByAdmin = status === PRODUCT_STATUS.ARCHIVED;
  await product.save();

  if (product.status !== previousStatus || product.takenDownByAdmin !== wasTakenDown) {
    await audit.record({
      actor: req.user,
      action: AUDIT_ACTION.PRODUCT_STATUS_CHANGED,
      entityType: AUDIT_ENTITY.PRODUCT,
      entityId: product._id,
      metadata: { name: product.name, from: previousStatus, to: product.status, takenDownByAdmin: product.takenDownByAdmin, vendorId: product.vendor?._id },
    });
  }

  res.json({ product: toAdminProductDTO(product) });
};

module.exports = { listProducts, updateProductStatus };

const { matchedData } = require("express-validator");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const PRODUCT_STATUS = require("../constants/productStatus");
const VENDOR_STATUS = require("../constants/vendorStatus");

const DEFAULT_LIMIT = 12;

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPublicProduct = (product) => ({
  id: product._id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price,
  stock: product.stock,
  images: product.images,
  status: product.status,
  category: product.category && {
    id: product.category._id,
    name: product.category.name,
    slug: product.category.slug,
  },
  vendor: product.vendor && {
    id: product.vendor._id,
    storeName: product.vendor.storeName,
    logo: product.vendor.logo,
  },
  createdAt: product.createdAt,
});

const emptyPage = (page, limit) => ({
  products: [],
  pagination: { page, limit, total: 0, totalPages: 1 },
});

const listProducts = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  const approvedVendorIds = await Vendor.find({ status: VENDOR_STATUS.APPROVED }).distinct("_id");
  const filter = { status: PRODUCT_STATUS.ACTIVE, vendor: { $in: approvedVendorIds } };

  if (q.vendor) {
    if (!approvedVendorIds.some((id) => id.equals(q.vendor))) {
      return res.json(emptyPage(page, limit));
    }
    filter.vendor = q.vendor;
  }

  if (q.category) {
    const category = OBJECT_ID.test(q.category)
      ? await Category.findById(q.category)
      : await Category.findOne({ slug: q.category.toLowerCase() });
    if (!category) {
      return res.json(emptyPage(page, limit));
    }
    filter.category = category._id;
  }

  if (q.search) {
    const pattern = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("vendor", "storeName logo")
      .populate("category", "name slug")
      .sort(SORTS[q.sort || "newest"])
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    products: products.map(toPublicProduct),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

const getProduct = async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, status: PRODUCT_STATUS.ACTIVE })
    .populate("vendor", "storeName storeDescription logo status")
    .populate("category", "name slug");

  if (!product || !product.vendor || product.vendor.status !== VENDOR_STATUS.APPROVED) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json({
    product: {
      ...toPublicProduct(product),
      vendor: {
        id: product.vendor._id,
        storeName: product.vendor.storeName,
        storeDescription: product.vendor.storeDescription,
        logo: product.vendor.logo,
      },
    },
  });
};

module.exports = { listProducts, getProduct };

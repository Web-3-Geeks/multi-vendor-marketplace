const { matchedData } = require("express-validator");
const Product = require("../models/Product");
const escapeRegex = require("../utils/escapeRegex");
const { pageParams, pageInfo } = require("../utils/pagination");
const Category = require("../models/Category");
const PRODUCT_STATUS = require("../constants/productStatus");
const uniqueSlug = require("../utils/uniqueSlug");
const { publishErrors } = require("../utils/productRules");

const EDITABLE_FIELDS = ["name", "description", "price", "stock", "category", "images", "status"];

const createProduct = async (req, res) => {
  const data = {};
  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }

  if (!(await Category.exists({ _id: data.category }))) {
    return res.status(400).json({ message: "Category does not exist" });
  }

  const product = new Product({
    ...data,
    vendor: req.vendor._id,
    slug: uniqueSlug(data.name),
  });

  if (product.status === PRODUCT_STATUS.ACTIVE) {
    const errors = publishErrors(product);
    if (errors.length) {
      return res.status(400).json({ message: "Product cannot be published", errors });
    }
  }

  await product.save();
  res.status(201).json({ product });
};

// `summary` counts the whole store, so the dashboard numbers don't depend on
// which page or filter is showing.
const listMyProducts = async (req, res) => {
  const query = matchedData(req, { locations: ["query"] });
  const { page, limit, skip } = pageParams(query);

  const filter = { vendor: req.vendor._id };
  if (query.status) filter.status = query.status;
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), "i");

  const [products, total, byStatus] = await Promise.all([
    Product.find(filter).populate("category", "name slug").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { vendor: req.vendor._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const count = (status) => byStatus.find((entry) => entry._id === status)?.count || 0;
  res.json({
    products,
    pagination: pageInfo(page, limit, total),
    summary: {
      total: byStatus.reduce((sum, entry) => sum + entry.count, 0),
      active: count(PRODUCT_STATUS.ACTIVE),
      outOfStock: count(PRODUCT_STATUS.OUT_OF_STOCK),
    },
  });
};

const getMyProduct = async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    vendor: req.vendor._id,
  }).populate("category", "name slug");

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }
  res.json({ product });
};

const updateMyProduct = async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  if (product.takenDownByAdmin && req.body.status !== undefined && req.body.status !== PRODUCT_STATUS.ARCHIVED) {
    return res.status(403).json({ message: "This product was taken down by an admin and cannot be published" });
  }

  if (req.body.category !== undefined && !(await Category.exists({ _id: req.body.category }))) {
    return res.status(400).json({ message: "Category does not exist" });
  }

  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) product[key] = req.body[key];
  }

  if (req.body.name !== undefined) {
    product.slug = uniqueSlug(product.name);
  }

  const goingLive =
    product.status === PRODUCT_STATUS.ACTIVE || product.status === PRODUCT_STATUS.OUT_OF_STOCK;
  if (goingLive) {
    const errors = publishErrors(product);
    if (errors.length) {
      return res.status(400).json({ message: "Product cannot be published", errors });
    }
  }

  await product.save();
  res.json({ product });
};

const archiveMyProduct = async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, vendor: req.vendor._id });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  product.status = PRODUCT_STATUS.ARCHIVED;
  await product.save();

  res.json({ message: "Product archived", product });
};

module.exports = { createProduct, listMyProducts, getMyProduct, updateMyProduct, archiveMyProduct };

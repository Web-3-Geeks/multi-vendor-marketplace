const crypto = require("crypto");
const request = require("supertest");
const app = require("../../expressApp");
const User = require("../../models/User");
const Vendor = require("../../models/Vendor");
const Category = require("../../models/Category");
const Product = require("../../models/Product");
const ROLES = require("../../constants/roles");
const VENDOR_STATUS = require("../../constants/vendorStatus");
const PRODUCT_STATUS = require("../../constants/productStatus");

const PASSWORD = "Passw0rd123";
const ADDRESS = Object.freeze({
  fullName: "Ayesha Khan",
  phone: "+92 300 1234567",
  line1: "12 Garden Road",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
});

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(++counter).toString(36)}`;

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const login = async (email, password = PASSWORD) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
};

// Users are created straight through the model (the API can only create customers).
const createUser = async ({ role = ROLES.CUSTOMER, name } = {}) => {
  const email = `user-${unique()}@test.com`;
  const user = await User.create({ name: name || `Test ${role.toLowerCase()} ${unique()}`, email, password: PASSWORD, role });
  const token = await login(email);
  return { id: String(user._id), email, name: user.name, password: PASSWORD, token, role };
};

const createAdmin = () => createUser({ role: ROLES.ADMIN });

const createVendor = async ({ status = VENDOR_STATUS.APPROVED, storeName } = {}) => {
  const owner = await createUser({ role: ROLES.VENDOR });
  const vendor = await Vendor.create({
    user: owner.id,
    storeName: storeName || `Store ${unique()}`,
    storeDescription: "A store used in tests",
    status,
  });
  return { ...owner, vendorId: String(vendor._id), storeName: vendor.storeName };
};

let defaultCategory;
const getCategory = async () => {
  defaultCategory = defaultCategory || (await Category.create({ name: `Category ${unique()}`, slug: `category-${unique()}` }));
  return defaultCategory;
};

const createProduct = async (vendor, { name, price = 10, stock = 50, status = PRODUCT_STATUS.ACTIVE, description = "A test product", category } = {}) => {
  const cat = category || (await getCategory());
  return Product.create({
    vendor: vendor.vendorId,
    category: cat._id,
    name: name || `Product ${unique()}`,
    slug: `product-${unique()}`,
    description,
    price,
    stock,
    status,
  });
};

const addToCart = (customer, productId, quantity = 1) =>
  request(app).post("/api/cart/items").set(bearer(customer.token)).send({ productId: String(productId), quantity });

const checkout = (customer, address = ADDRESS) =>
  request(app).post("/api/checkout").set(bearer(customer.token)).send({ shippingAddress: address });

// lines: [[product, quantity], ...]. Fills the cart and checks out, returning the order.
const placeOrder = async (customer, lines, address) => {
  for (const [product, quantity] of lines) {
    const res = await addToCart(customer, product._id || product, quantity);
    if (res.status !== 201) throw new Error(`addToCart failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const res = await checkout(customer, address);
  if (res.status !== 201) throw new Error(`checkout failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.order;
};

const createPayment = (customer, orderId) =>
  request(app).post("/api/payments/create").set(bearer(customer.token)).send({ orderId: String(orderId) });

const verifyPayment = (customer, transactionId) =>
  request(app).post("/api/payments/verify").set(bearer(customer.token)).send({ transactionId });

const mockPay = (customer, transactionId, outcome = "success", deliverWebhook) =>
  request(app)
    .post("/api/payments/mock/pay")
    .set(bearer(customer.token))
    .send({ transactionId, outcome, ...(deliverWebhook === undefined ? {} : { deliverWebhook }) });

// Creates a payment and completes it through the (mock) provider's signed webhook.
const payOrder = async (customer, orderId) => {
  const created = await createPayment(customer, orderId);
  if (created.status !== 201) throw new Error(`createPayment failed: ${created.status} ${JSON.stringify(created.body)}`);
  const paid = await mockPay(customer, created.body.payment.transactionId, "success");
  if (paid.body.payment?.status !== "PAID") throw new Error(`payment not settled: ${JSON.stringify(paid.body)}`);
  return paid.body.payment;
};

const webhookSignature = (raw) =>
  crypto.createHmac("sha256", process.env.PAYMENT_WEBHOOK_SECRET).update(raw).digest("hex");

const paymentEvent = ({ id = `evt_${unique()}`, type = "payment.succeeded", payment, orderId, amount, currency = "USD" }) => ({
  id,
  type,
  data: {
    transactionId: payment.transactionId,
    orderId: String(orderId || payment.orderId),
    amount: amount ?? payment.amount,
    currency,
  },
});

const postWebhook = (event, signature) => {
  const raw = typeof event === "string" ? event : JSON.stringify(event);
  return request(app)
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-payment-signature", signature === undefined ? webhookSignature(raw) : signature)
    .send(raw);
};

// Mongoose treats createdAt as immutable, so tests that need an old order go through the raw collection.
const backdateOrder = (orderId, hours) =>
  require("../../models/Order").collection.updateOne(
    { _id: new (require("mongoose").Types.ObjectId)(String(orderId)) },
    { $set: { createdAt: new Date(Date.now() - hours * 3600 * 1000) } },
  );

const api = () => request(app);

module.exports = {
  api,
  app,
  backdateOrder,
  ADDRESS,
  PASSWORD,
  ROLES,
  VENDOR_STATUS,
  PRODUCT_STATUS,
  unique,
  bearer,
  login,
  createUser,
  createAdmin,
  createVendor,
  getCategory,
  createProduct,
  addToCart,
  checkout,
  placeOrder,
  createPayment,
  verifyPayment,
  mockPay,
  payOrder,
  webhookSignature,
  paymentEvent,
  postWebhook,
};

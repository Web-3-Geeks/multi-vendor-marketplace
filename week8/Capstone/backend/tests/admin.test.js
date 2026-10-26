const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");

beforeAll(db.connect);
afterAll(db.disconnect);

let admin;
let vendor;
beforeAll(async () => {
  admin = await f.createAdmin();
  vendor = await f.createVendor();
});

const asAdmin = (method, path, body) => f.api()[method](`/api${path}`).set(f.bearer(admin.token)).send(body);
const refund = (paymentId, body = {}) => asAdmin("post", `/admin/payments/${paymentId}/refund`, body);
const setOrderStatus = (orderId, status) => asAdmin("patch", `/admin/orders/${orderId}/status`, { status });
const setItemStatus = (v, orderId, status) => f.api().patch(`/api/vendor/orders/${orderId}/status`).set(f.bearer(v.token)).send({ status });

const buy = async (customer, opts = {}) => {
  const product = await f.createProduct(vendor, { price: 10, stock: 100, ...opts });
  const order = await f.placeOrder(customer, [[product, opts.qty || 2]]);
  return { product, order };
};

describe("admin order management", () => {
  let customer;
  let orders;
  beforeAll(async () => {
    customer = await f.createUser({ name: "Zainab Search" });
    orders = [];
    for (let i = 0; i < 3; i += 1) orders.push((await buy(customer)).order);
    await f.payOrder(customer, orders[0].id);
  });

  test("lists every customer's orders with customer details, item counts and totals", async () => {
    const res = await asAdmin("get", `/admin/orders?search=${customer.email}&limit=50`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(3);
    expect(res.body.orders[0]).toMatchObject({ customer: { email: customer.email, name: "Zainab Search" }, itemCount: 1, totalAmount: 20 });
  });

  test("searches by customer name, email, full order id or the short #id, and combines filters", async () => {
    expect((await asAdmin("get", "/admin/orders?search=Zainab Search")).body.orders).toHaveLength(3);
    expect((await asAdmin("get", `/admin/orders?search=${orders[1].id}`)).body.orders.map((o) => o.id)).toEqual([orders[1].id]);
    expect((await asAdmin("get", `/admin/orders?search=${orders[2].id.slice(-8)}`)).body.orders.map((o) => o.id)).toContain(orders[2].id);
    const combined = await asAdmin("get", `/admin/orders?search=${customer.email}&paymentStatus=PAID`);
    expect(combined.body.orders.map((o) => o.id)).toEqual([orders[0].id]);
    expect((await asAdmin("get", `/admin/orders?search=${customer.email}&status=CONFIRMED`)).body.orders).toHaveLength(1);
    expect((await asAdmin("get", "/admin/orders?search=.*")).body.orders).toHaveLength(0);
  });

  test("paginates and validates filters", async () => {
    const res = await asAdmin("get", `/admin/orders?search=${customer.email}&limit=2&page=2`);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ total: 3, totalPages: 2 });
    for (const bad of ["status=NOPE", "paymentStatus=NOPE", "page=0", "limit=100"]) {
      expect((await asAdmin("get", `/admin/orders?${bad}`)).status).toBe(400);
    }
  });

  test("the detail view has the customer, the address, items per vendor and every payment attempt", async () => {
    const res = await asAdmin("get", `/admin/orders/${orders[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ paymentStatus: "PAID", customer: { email: customer.email }, shippingAddress: { city: "Lahore" } });
    expect(res.body.order.items[0].vendor.storeName).toBe(vendor.storeName);
    expect(res.body.order.payments).toHaveLength(1);
    expect(res.body.order.payments[0].status).toBe("PAID");
    expect((await asAdmin("get", "/admin/orders/507f1f77bcf86cd799439011")).status).toBe(404);
    expect((await asAdmin("get", "/admin/orders/nope")).status).toBe(400);
  });

  test("customers and vendors get no admin order access", async () => {
    for (const user of [customer, vendor]) {
      expect((await f.api().get("/api/admin/orders").set(f.bearer(user.token))).status).toBe(403);
      expect((await f.api().get(`/api/admin/orders/${orders[0].id}`).set(f.bearer(user.token))).status).toBe(403);
      expect((await f.api().patch(`/api/admin/orders/${orders[0].id}/status`).set(f.bearer(user.token)).send({ status: "CANCELLED" })).status).toBe(403);
    }
  });

  test("an unpaid order can be cancelled: stock returns and it becomes unpayable", async () => {
    const buyer = await f.createUser();
    const { product, order } = await buy(buyer, { stock: 10, qty: 3 });
    expect((await Product.findById(product._id)).stock).toBe(7);
    const res = await setOrderStatus(order.id, "CANCELLED");
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "CANCELLED", paymentStatus: "CANCELLED" });
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await f.createPayment(buyer, order.id)).status).toBe(400);
    expect((await setOrderStatus(order.id, "CANCELLED")).status).toBe(400);
  });

  test("a paid order can't be cancelled directly: it must be refunded", async () => {
    const res = await setOrderStatus(orders[0].id, "CANCELLED");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/refunded/);
  });

  test("an unpaid order can't be moved forward", async () => {
    const res = await setOrderStatus(orders[1].id, "PROCESSING");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not been paid/);
  });

  test("a paid order moves forward one step at a time", async () => {
    const buyer = await f.createUser();
    const { order } = await buy(buyer);
    await f.payOrder(buyer, order.id);
    expect((await setOrderStatus(order.id, "SHIPPED")).status).toBe(400);
    expect((await setOrderStatus(order.id, "PROCESSING")).body.order.status).toBe("PROCESSING");
    expect((await setOrderStatus(order.id, "SHIPPED")).body.order.status).toBe("SHIPPED");
    expect((await setOrderStatus(order.id, "DELIVERED")).body.order.status).toBe("DELIVERED");
    expect((await Commission.findOne({ order: order.id })).status).toBe("PAID");
    expect((await setOrderStatus(order.id, "PROCESSING")).status).toBe(400);
  });

  test("only the statuses an admin may set are accepted", async () => {
    for (const status of ["CONFIRMED", "PENDING", "BOGUS", "", { $ne: 1 }]) {
      expect((await setOrderStatus(orders[1].id, status)).status).toBe(400);
    }
    expect((await setOrderStatus("nope", "CANCELLED")).status).toBe(400);
    expect((await setOrderStatus("507f1f77bcf86cd799439011", "CANCELLED")).status).toBe(404);
  });
});

describe("admin payment management", () => {
  let customer;
  let paid;
  let pending;
  beforeAll(async () => {
    customer = await f.createUser({ name: "Payer Person" });
    const a = await buy(customer, { price: 40, qty: 1 });
    paid = await f.payOrder(customer, a.order.id);
    const b = await buy(customer, { price: 15, qty: 1 });
    pending = (await f.createPayment(customer, b.order.id)).body.payment;
  });

  test("lists payments with customer, order, amount and status", async () => {
    const res = await asAdmin("get", `/admin/payments?search=${paid.transactionId}`);
    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({ amount: 40, status: "PAID", provider: "mock", customer: { email: customer.email, name: "Payer Person" } });
    expect(res.body.payments[0].order.id).toEqual(expect.any(String));
  });

  test("searches by part of the transaction id, filters by status and date", async () => {
    expect((await asAdmin("get", `/admin/payments?search=${paid.transactionId.slice(-10)}`)).body.payments).toHaveLength(1);
    const pendingOnly = await asAdmin("get", "/admin/payments?status=PENDING&limit=50");
    expect(pendingOnly.body.payments.every((p) => p.status === "PENDING")).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    expect((await asAdmin("get", `/admin/payments?from=${today}&to=${today}&limit=50`)).body.payments.length).toBeGreaterThanOrEqual(2);
    expect((await asAdmin("get", "/admin/payments?from=2999-01-01")).body.payments).toHaveLength(0);
    expect((await asAdmin("get", "/admin/payments?search=.*")).body.payments).toHaveLength(0);
  });

  test("never exposes provider secrets, webhook ids or card data", async () => {
    const res = await asAdmin("get", `/admin/payments/${paid.id}`);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(process.env.PAYMENT_SECRET_KEY);
    expect(text).not.toContain(process.env.PAYMENT_WEBHOOK_SECRET);
    expect(text).not.toMatch(/processedEventIds|cvv|cardNumber/i);
  });

  test("the detail has the customer, the order and its items with their vendors", async () => {
    const res = await asAdmin("get", `/admin/payments/${paid.id}`);
    expect(res.body.payment.customer.email).toBe(customer.email);
    expect(res.body.payment.items).toHaveLength(1);
    expect(res.body.payment.items[0].vendor.storeName).toBe(vendor.storeName);
    expect((await asAdmin("get", "/admin/payments/nope")).status).toBe(400);
    expect((await asAdmin("get", "/admin/payments/507f1f77bcf86cd799439011")).status).toBe(404);
  });

  test.each(["status=NOPE", "from=x", "page=0", "limit=51"])("rejects ?%s with 400", async (query) => {
    expect((await asAdmin("get", `/admin/payments?${query}`)).status).toBe(400);
  });

  test("customers and vendors can't list or open payments", async () => {
    for (const user of [customer, vendor]) {
      expect((await f.api().get("/api/admin/payments").set(f.bearer(user.token))).status).toBe(403);
      expect((await f.api().get(`/api/admin/payments/${paid.id}`).set(f.bearer(user.token))).status).toBe(403);
    }
    expect((await f.api().get("/api/admin/payments")).status).toBe(401);
  });

  test("a pending payment isn't eligible for a refund", async () => {
    const res = await refund(pending.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only a paid payment/);
  });
});

describe("refunds", () => {
  test("only an admin can refund: customers (even the payer), vendors and anonymous callers are refused", async () => {
    const customer = await f.createUser();
    const { order } = await buy(customer);
    const payment = await f.payOrder(customer, order.id);
    for (const user of [customer, vendor]) {
      const res = await f.api().post(`/api/admin/payments/${payment.id}/refund`).set(f.bearer(user.token)).send({});
      expect(res.status).toBe(403);
    }
    expect((await f.api().post(`/api/admin/payments/${payment.id}/refund`).send({})).status).toBe(401);
    expect((await Payment.findById(payment.id)).status).toBe("PAID");
  });

  test("refunding returns the money at the provider and updates payment, order, items, stock and commissions together", async () => {
    const customer = await f.createUser();
    const { product, order } = await buy(customer, { stock: 10, qty: 3, price: 20 });
    const payment = await f.payOrder(customer, order.id);
    expect((await Product.findById(product._id)).stock).toBe(7);

    const res = await refund(payment.id, { reason: "Customer changed their mind" });
    expect(res.status).toBe(200);
    expect(res.body.payment).toMatchObject({ status: "REFUNDED", refund: { reason: "Customer changed their mind" } });
    expect(res.body.payment.refund.id).toMatch(/^mock_re_/);

    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    expect((await OrderItem.find({ order: order.id })).every((i) => i.status === "CANCELLED")).toBe(true);
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await Commission.find({ order: order.id })).every((c) => c.status === "REFUNDED")).toBe(true);
    const stored = await Payment.findById(payment.id);
    expect(String(stored.refundedBy)).toBe(admin.id);
    expect(stored.refundedAt).toBeInstanceOf(Date);
  });

  test("a payment can only be refunded once, even when several requests arrive together", async () => {
    const customer = await f.createUser();
    const { product, order } = await buy(customer, { stock: 10, qty: 2 });
    const payment = await f.payOrder(customer, order.id);

    const results = await Promise.all([refund(payment.id), refund(payment.id), refund(payment.id)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => r.status < 500)).toBe(true);
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect((await refund(payment.id)).status).toBe(409);
  });

  test("a delivered item is not cancelled by a refund, but its earnings are refunded", async () => {
    const customer = await f.createUser();
    const other = await f.createVendor();
    const mine = await f.createProduct(vendor, { stock: 10, price: 10 });
    const theirs = await f.createProduct(other, { stock: 10, price: 10 });
    const order = await f.placeOrder(customer, [[mine, 1], [theirs, 1]]);
    const payment = await f.payOrder(customer, order.id);
    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) await setItemStatus(vendor, order.id, status);

    expect((await refund(payment.id)).status).toBe(200);
    const items = await OrderItem.find({ order: order.id });
    expect(items.find((i) => String(i.vendor) === vendor.vendorId).status).toBe("DELIVERED");
    expect(items.find((i) => String(i.vendor) === other.vendorId).status).toBe("CANCELLED");
    expect((await Order.findById(order.id)).status).toBe("DELIVERED");
    expect((await Commission.find({ order: order.id })).every((c) => c.status === "REFUNDED")).toBe(true);
    expect((await Product.findById(mine._id)).stock).toBe(9);
    expect((await Product.findById(theirs._id)).stock).toBe(10);
  });

  test("a refunded order can't be paid again", async () => {
    const customer = await f.createUser();
    const { order } = await buy(customer);
    const payment = await f.payOrder(customer, order.id);
    await refund(payment.id);
    expect((await f.createPayment(customer, order.id)).status).toBeGreaterThanOrEqual(400);
  });

  test("the reason is optional, must be text and is length-limited; ids are validated", async () => {
    const customer = await f.createUser();
    const { order } = await buy(customer);
    const payment = await f.payOrder(customer, order.id);
    expect((await refund(payment.id, { reason: { x: 1 } })).status).toBe(400);
    expect((await refund(payment.id, { reason: "x".repeat(501) })).status).toBe(400);
    expect((await refund("nope")).status).toBe(400);
    expect((await refund("507f1f77bcf86cd799439011")).status).toBe(404);
    expect((await refund(payment.id)).status).toBe(200);
  });

  test("the provider refuses a second refund for the same transaction", async () => {
    const customer = await f.createUser();
    const { order } = await buy(customer);
    const payment = await f.payOrder(customer, order.id);
    await refund(payment.id);
    await Payment.updateOne({ _id: payment.id }, { status: "PAID" });
    const res = await refund(payment.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be refunded/);
  });
});

describe("the marketplace dashboard numbers", () => {
  test("add up from the database", async () => {
    const before = (await asAdmin("get", "/admin/stats")).body.stats;
    const customer = await f.createUser();
    const a = await buy(customer, { price: 50, qty: 2 });
    const b = await buy(customer, { price: 20, qty: 1 });
    await buy(customer, { price: 5, qty: 1 });
    await f.payOrder(customer, a.order.id);
    const failing = (await f.createPayment(customer, b.order.id)).body.payment;
    await f.mockPay(customer, failing.transactionId, "failure");

    const after = (await asAdmin("get", "/admin/stats")).body.stats;
    expect(after.totalOrders - before.totalOrders).toBe(3);
    expect(after.paidOrders - before.paidOrders).toBe(1);
    expect(after.failedPayments - before.failedPayments).toBe(1);
    expect(after.pendingPayments - before.pendingPayments).toBe(1);
    expect(after.totalSales - before.totalSales).toBe(100);
    expect(after.totalCommission - before.totalCommission).toBe(10);
    expect(after.vendorEarnings - before.vendorEarnings).toBe(90);

    const payment = (await Payment.findOne({ order: a.order.id }))._id;
    await refund(payment);
    const refunded = (await asAdmin("get", "/admin/stats")).body.stats;
    expect(refunded.totalSales).toBe(before.totalSales);
    expect(refunded.totalCommission).toBe(before.totalCommission);
    expect(refunded.refundedPayments - before.refundedPayments).toBe(1);
  });

  test("are admin-only", async () => {
    const customer = await f.createUser();
    expect((await f.api().get("/api/admin/stats").set(f.bearer(customer.token))).status).toBe(403);
    expect((await f.api().get("/api/admin/stats").set(f.bearer(vendor.token))).status).toBe(403);
  });
});

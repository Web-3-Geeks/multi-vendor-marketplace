// The complete journeys, driven only through the HTTP API, one role at a time.
const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");
const AuditLog = require("../models/AuditLog");

beforeAll(db.connect);
afterAll(db.disconnect);

const auth = (user) => f.bearer(user.token);

describe("workflow 1: a customer registers, browses, fills a cart and places an order", () => {
  test("from sign-up to a PENDING order with the stock reserved", async () => {
    const seller = await f.createVendor();
    const mouse = await f.createProduct(seller, { name: "Journey Mouse", price: 25, stock: 10 });
    const lamp = await f.createProduct(await f.createVendor(), { name: "Journey Lamp", price: 40, stock: 10 });

    const email = `journey-${f.unique()}@test.com`;
    const registered = await f.api().post("/api/auth/register").send({ name: "Journey Customer", email, password: "Passw0rd123" });
    expect(registered.status).toBe(201);
    const login = await f.api().post("/api/auth/login").send({ email, password: "Passw0rd123" });
    const customer = { token: login.body.token };

    const browse = await f.api().get("/api/products?search=Journey&sort=price_asc");
    expect(browse.body.products.map((p) => p.name)).toEqual(["Journey Mouse", "Journey Lamp"]);
    const detail = await f.api().get(`/api/products/${browse.body.products[0].id}`);
    expect(detail.body.product.price).toBe(25);

    await f.addToCart(customer, mouse._id, 2);
    const cart = await f.addToCart(customer, lamp._id, 1);
    expect(cart.body.cart).toMatchObject({ subtotal: 90, itemCount: 3 });
    expect(cart.body.cart.vendorGroups).toHaveLength(2);

    const checkout = await f.checkout(customer);
    expect(checkout.status).toBe(201);
    expect(checkout.body.order).toMatchObject({ status: "PENDING", paymentStatus: "PENDING", totalAmount: 90 });
    expect((await Product.findById(mouse._id)).stock).toBe(8);
    expect((await f.api().get("/api/cart").set(auth(customer))).body.cart.items).toHaveLength(0);

    const history = await f.api().get("/api/orders").set(auth(customer));
    expect(history.body.orders).toHaveLength(1);
    expect(history.body.orders[0].id).toBe(checkout.body.order.id);
  });
});

describe("workflow 2: payment is completed, verified, and the order gets the right status", () => {
  test("pay -> webhook -> verify: PAID, order CONFIRMED, vendor earnings created once", async () => {
    const seller = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(seller, { price: 60, stock: 10 });
    const order = await f.placeOrder(customer, [[product, 1]]);

    const created = await f.createPayment(customer, order.id);
    expect(created.body.payment).toMatchObject({ status: "PENDING", amount: 60 });
    expect((await Order.findById(order.id)).paymentStatus).toBe("PENDING");

    const paid = await f.mockPay(customer, created.body.payment.transactionId, "success");
    expect(paid.body.payment.status).toBe("PAID");
    const verified = await f.verifyPayment(customer, created.body.payment.transactionId);
    expect(verified.body.payment.status).toBe("PAID");

    const seen = await f.api().get(`/api/orders/${order.id}`).set(auth(customer));
    expect(seen.body.order).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(seen.body.order.items[0].status).toBe("CONFIRMED");
    expect(await Commission.countDocuments({ order: order.id })).toBe(1);
  });

  test("a failed payment never confirms the order, and a retry succeeds", async () => {
    const seller = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(seller, { price: 15, stock: 10 });
    const order = await f.placeOrder(customer, [[product, 1]]);

    const first = await f.createPayment(customer, order.id);
    await f.mockPay(customer, first.body.payment.transactionId, "failure");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "PENDING", paymentStatus: "FAILED" });
    expect(await Commission.countDocuments({ order: order.id })).toBe(0);

    const retry = await f.createPayment(customer, order.id);
    await f.mockPay(customer, retry.body.payment.transactionId, "success");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(await Payment.countDocuments({ order: order.id })).toBe(2);
  });
});

describe("workflow 3: a vendor fulfils an order and sees the right earnings", () => {
  test("sees only their own items, ships them, and the earnings move from pending to paid", async () => {
    const mine = await f.createVendor();
    const theirs = await f.createVendor();
    const customer = await f.createUser();
    const myProduct = await f.createProduct(mine, { name: "Mine", price: 100, stock: 10 });
    const theirProduct = await f.createProduct(theirs, { name: "Theirs", price: 50, stock: 10 });
    const order = await f.placeOrder(customer, [[myProduct, 2], [theirProduct, 1]]);
    await f.payOrder(customer, order.id);

    const list = await f.api().get("/api/vendor/orders").set(auth(mine));
    expect(list.body.orders).toHaveLength(1);
    expect(list.body.orders[0]).toMatchObject({ orderId: order.id, vendorSubtotal: 200, paymentStatus: "PAID" });
    expect(JSON.stringify(list.body)).not.toContain("Theirs");
    expect(list.body.orders[0].shippingAddress.fullName).toBe(f.ADDRESS.fullName);

    let earnings = (await f.api().get("/api/vendor/earnings").set(auth(mine))).body.summary;
    expect(earnings).toMatchObject({ totalSales: 200, totalCommission: 20, netEarnings: 180, pendingEarnings: 180, paidEarnings: 0 });

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      const res = await f.api().patch(`/api/vendor/orders/${order.id}/status`).set(auth(mine)).send({ status });
      expect(res.status).toBe(200);
    }
    earnings = (await f.api().get("/api/vendor/earnings").set(auth(mine))).body.summary;
    expect(earnings).toMatchObject({ pendingEarnings: 0, paidEarnings: 180 });

    expect((await f.api().get(`/api/vendor/orders/${order.id}`).set(auth(theirs))).body.order.items[0].status).toBe("CONFIRMED");
    expect((await Order.findById(order.id)).status).toBe("CONFIRMED");
  });
});

describe("workflow 4: an admin onboards a vendor, manages orders and payments, and refunds", () => {
  test("approve a vendor, watch their order, refund it, and the books balance", async () => {
    const admin = await f.createAdmin();
    const applicant = await f.createUser();
    const applied = await f.api().post("/api/vendors").set(auth(applicant)).send({ storeName: `Admin Journey ${f.unique()}`, storeDescription: "New store" });
    expect(applied.body.vendor.status).toBe("PENDING");
    const approved = await f.api().patch(`/api/admin/vendors/${applied.body.vendor.id}/status`).set(auth(admin)).send({ status: "APPROVED" });
    expect(approved.body.vendor.status).toBe("APPROVED");

    const category = await f.getCategory();
    const listing = await f.api().post("/api/vendor/products").set(auth(applicant)).send({
      name: "Journey Gadget", description: "Shiny", price: 80, stock: 5, category: String(category._id), status: "ACTIVE",
    });
    expect(listing.status).toBe(201);
    const productId = listing.body.product._id;

    const customer = await f.createUser();
    const order = await f.placeOrder(customer, [[productId, 2]]);
    const payment = await f.payOrder(customer, order.id);

    const orders = await f.api().get(`/api/admin/orders?search=${order.id}`).set(auth(admin));
    expect(orders.body.orders[0]).toMatchObject({ id: order.id, paymentStatus: "PAID", totalAmount: 160 });
    const payments = await f.api().get(`/api/admin/payments?search=${payment.transactionId}`).set(auth(admin));
    expect(payments.body.payments[0]).toMatchObject({ status: "PAID", amount: 160 });
    const stats = (await f.api().get("/api/admin/stats").set(auth(admin))).body.stats;
    expect(stats.paidOrders).toBeGreaterThanOrEqual(1);

    expect((await f.api().patch(`/api/admin/orders/${order.id}/status`).set(auth(admin)).send({ status: "CANCELLED" })).status).toBe(400);
    expect((await f.api().post(`/api/admin/payments/${payment.id}/refund`).set(auth(customer)).send({})).status).toBe(403);
    const refunded = await f.api().post(`/api/admin/payments/${payment.id}/refund`).set(auth(admin)).send({ reason: "Journey refund" });
    expect(refunded.status).toBe(200);

    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    expect((await Product.findById(productId)).stock).toBe(5);
    expect((await f.api().get("/api/vendor/earnings").set(auth(applicant))).body.summary.netEarnings).toBe(0);
    const trail = await f.api().get(`/api/admin/audit-logs?orderId=${order.id}&limit=50`).set(auth(admin));
    expect(trail.body.logs.map((l) => l.action)).toEqual(expect.arrayContaining(["PAYMENT_CREATED", "PAYMENT_PAID", "PAYMENT_REFUNDED"]));
  });
});

describe("workflow 5: failed payments and duplicate webhooks leave no wrong records", () => {
  test("replayed and out-of-order events change nothing beyond the first outcome", async () => {
    const seller = await f.createVendor();
    const customer = await f.createUser();
    const product = await f.createProduct(seller, { price: 30, stock: 20 });
    const order = await f.placeOrder(customer, [[product, 3]]);
    const { body } = await f.createPayment(customer, order.id);

    const success = f.paymentEvent({ payment: body.payment });
    const failure = f.paymentEvent({ payment: body.payment, type: "payment.failed" });
    const sequence = [success, success, failure, success, failure];
    for (const event of sequence) expect((await f.postWebhook(event)).status).toBe(200);
    await Promise.all(sequence.map((event) => f.postWebhook(event)));

    expect((await Payment.findById(body.payment.id)).status).toBe("PAID");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect(await Commission.countDocuments({ order: order.id })).toBe(1);
    expect(await OrderItem.countDocuments({ order: order.id, status: "CONFIRMED" })).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(17);
    expect(await AuditLog.countDocuments({ order: order.id, action: "PAYMENT_PAID" })).toBe(1);
    expect(await AuditLog.countDocuments({ order: order.id, action: "PAYMENT_FAILED" })).toBe(0);
    expect(await Payment.countDocuments({ order: order.id })).toBe(1);
  });

  test("two customers racing for the last unit, both paying: only the winner has an order to pay", async () => {
    const seller = await f.createVendor();
    const product = await f.createProduct(seller, { price: 10, stock: 1 });
    const [one, two] = await Promise.all([f.createUser(), f.createUser()]);
    await f.addToCart(one, product._id, 1);
    await f.addToCart(two, product._id, 1);
    const results = await Promise.all([f.checkout(one), f.checkout(two)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await Product.findById(product._id)).stock).toBe(0);
    expect(await Order.countDocuments({ "user": { $in: [one.id, two.id] } })).toBe(1);
  });
});

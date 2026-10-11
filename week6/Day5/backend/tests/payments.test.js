const db = require("./helpers/db");
const f = require("./helpers/factory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const Commission = require("../models/Commission");
const AuditLog = require("../models/AuditLog");
const MockTransaction = require("../models/MockTransaction");

beforeAll(db.connect);
afterAll(db.disconnect);

let vendor;
beforeAll(async () => {
  vendor = await f.createVendor();
});

const newOrder = async (customer, { price = 10, qty = 2, stock = 100 } = {}) => {
  const product = await f.createProduct(vendor, { price, stock });
  const order = await f.placeOrder(customer, [[product, qty]]);
  return { product, order };
};

describe("creating a payment", () => {
  test("is built from the order in the database: the client sends only an order id", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer, { price: 25, qty: 2 });
    const res = await f.api().post("/api/payments/create").set(f.bearer(customer.token)).send({ orderId: order.id, amount: 1, currency: "EUR", status: "PAID" });
    expect(res.status).toBe(201);
    expect(res.body.payment).toMatchObject({ amount: 50, currency: "USD", status: "PENDING", provider: "mock", orderId: order.id });
    expect(res.body.payment.transactionId).toMatch(/^mock_txn_/);
    expect(res.body.publicKey).toBe(process.env.PAYMENT_PUBLIC_KEY);
  });

  test("the response never contains secrets or internals", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const res = await f.createPayment(customer, order.id);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(process.env.PAYMENT_SECRET_KEY);
    expect(text).not.toContain(process.env.PAYMENT_WEBHOOK_SECRET);
    expect(text).not.toMatch(/processedEventIds|refund|cvv|cardNumber|card_number/i);
  });

  test("asking again returns the same open payment instead of a new one", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const first = await f.createPayment(customer, order.id);
    const second = await f.createPayment(customer, order.id);
    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(await Payment.countDocuments({ order: order.id })).toBe(1);
  });

  test("six requests at once still produce exactly one open payment", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const results = await Promise.all(Array.from({ length: 6 }, () => f.createPayment(customer, order.id)));
    expect(new Set(results.map((r) => r.body.payment.id)).size).toBe(1);
    expect(await Payment.countDocuments({ order: order.id, status: { $in: ["PENDING", "PROCESSING"] } })).toBe(1);
  });

  test("somebody else's order is a 404 and creates nothing", async () => {
    const owner = await f.createUser();
    const stranger = await f.createUser();
    const { order } = await newOrder(owner);
    expect((await f.createPayment(stranger, order.id)).status).toBe(404);
    expect(await Payment.countDocuments({ order: order.id })).toBe(0);
  });

  test("a cancelled order can't be paid and a paid one can't be paid twice", async () => {
    const customer = await f.createUser();
    const cancelled = await newOrder(customer);
    await Order.updateOne({ _id: cancelled.order.id }, { status: "CANCELLED" });
    const res = await f.createPayment(customer, cancelled.order.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancelled/i);

    const paid = await newOrder(customer);
    await f.payOrder(customer, paid.order.id);
    const again = await f.createPayment(customer, paid.order.id);
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already been paid/);
  });

  test.each([
    ["no body", undefined],
    ["an invalid id", { orderId: "abc" }],
    ["an object id", { orderId: { $ne: null } }],
    ["a missing id", {}],
  ])("rejects %s with 400", async (_label, body) => {
    const customer = await f.createUser();
    const res = await f.api().post("/api/payments/create").set(f.bearer(customer.token)).send(body);
    expect(res.status).toBe(400);
  });

  test("login is required", async () => {
    expect((await f.api().post("/api/payments/create").send({ orderId: "507f1f77bcf86cd799439011" })).status).toBe(401);
  });

  test("an unknown order is 404", async () => {
    const customer = await f.createUser();
    expect((await f.createPayment(customer, "507f1f77bcf86cd799439011")).status).toBe(404);
  });

  test("the latest payment of an order can be looked up by its owner only", async () => {
    const customer = await f.createUser();
    const stranger = await f.createUser();
    const { order } = await newOrder(customer);
    const empty = await f.api().get(`/api/payments/order/${order.id}`).set(f.bearer(customer.token));
    expect(empty.body.payment).toBeNull();
    const created = await f.createPayment(customer, order.id);
    const found = await f.api().get(`/api/payments/order/${order.id}`).set(f.bearer(customer.token));
    expect(found.body.payment.id).toBe(created.body.payment.id);
    const hidden = await f.api().get(`/api/payments/order/${order.id}`).set(f.bearer(stranger.token));
    expect(hidden.status).toBe(200);
    expect(hidden.body.payment).toBeNull();
    expect((await f.api().get("/api/payments/order/bad").set(f.bearer(customer.token))).status).toBe(400);
  });
});

describe("verifying a payment", () => {
  test("is PENDING until the provider says otherwise, and the order stays unpaid", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const { body } = await f.createPayment(customer, order.id);
    const res = await f.verifyPayment(customer, body.payment.transactionId);
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("PENDING");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "PENDING", paymentStatus: "PENDING" });
  });

  test("asks the provider, so a missed webhook doesn't matter: PAID, order and items CONFIRMED", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const { body } = await f.createPayment(customer, order.id);
    const silent = await f.mockPay(customer, body.payment.transactionId, "success", false);
    expect(silent.body.payment.status).toBe("PENDING");

    const res = await f.verifyPayment(customer, body.payment.transactionId);
    expect(res.body.payment.status).toBe("PAID");
    expect(res.body.payment.paidAt).toEqual(expect.any(String));
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect((await OrderItem.find({ order: order.id })).every((i) => i.status === "CONFIRMED")).toBe(true);
  });

  test("a failed payment at the provider keeps the order PENDING so the customer can retry", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const first = await f.createPayment(customer, order.id);
    await f.mockPay(customer, first.body.payment.transactionId, "failure", false);
    const res = await f.verifyPayment(customer, first.body.payment.transactionId);
    expect(res.body.payment.status).toBe("FAILED");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "PENDING", paymentStatus: "FAILED" });

    const retry = await f.createPayment(customer, order.id);
    expect(retry.status).toBe(201);
    expect(retry.body.payment.id).not.toBe(first.body.payment.id);
    const paid = await f.mockPay(customer, retry.body.payment.transactionId, "success");
    expect(paid.body.payment.status).toBe("PAID");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
  });

  test("verifying again is harmless: same result, same paidAt, no extra records", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const payment = await f.payOrder(customer, order.id);
    const again = await f.verifyPayment(customer, payment.transactionId);
    expect(again.body.payment).toMatchObject({ status: "PAID", paidAt: payment.paidAt });
    expect(await Commission.countDocuments({ order: order.id })).toBe(1);
  });

  test("somebody else's transaction is a 404, junk input is a 400", async () => {
    const owner = await f.createUser();
    const stranger = await f.createUser();
    const { order } = await newOrder(owner);
    const { body } = await f.createPayment(owner, order.id);
    expect((await f.verifyPayment(stranger, body.payment.transactionId)).status).toBe(404);
    expect((await f.verifyPayment(owner, "mock_txn_unknown")).status).toBe(404);
    for (const bad of [{}, { transactionId: "" }, { transactionId: { $ne: null } }, { transactionId: "x".repeat(101) }]) {
      expect((await f.api().post("/api/payments/verify").set(f.bearer(owner.token)).send(bad)).status).toBe(400);
    }
  });

  test("if the provider's amount doesn't match the order, nothing is marked paid", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer, { price: 10, qty: 3 });
    const { body } = await f.createPayment(customer, order.id);
    await f.mockPay(customer, body.payment.transactionId, "success", false);
    await MockTransaction.updateOne({ transactionId: body.payment.transactionId }, { amount: 1 });

    const res = await f.verifyPayment(customer, body.payment.transactionId);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not match/);
    expect((await Payment.findById(body.payment.id)).status).toBe("PENDING");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "PENDING", paymentStatus: "PENDING" });
    expect(await Commission.countDocuments({ order: order.id })).toBe(0);
  });

  test("a transaction that belongs to a different order is rejected", async () => {
    const customer = await f.createUser();
    const one = await newOrder(customer);
    const two = await newOrder(customer);
    const { body } = await f.createPayment(customer, one.order.id);
    await f.mockPay(customer, body.payment.transactionId, "success", false);
    await MockTransaction.updateOne({ transactionId: body.payment.transactionId }, { orderId: two.order.id });
    expect((await f.verifyPayment(customer, body.payment.transactionId)).status).toBe(400);
    expect((await Payment.findById(body.payment.id)).status).toBe("PENDING");
  });

  test("an expired session becomes CANCELLED and a new payment can be started", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const { body } = await f.createPayment(customer, order.id);
    const past = new Date(Date.now() - 60000);
    await Payment.updateOne({ _id: body.payment.id }, { expiresAt: past });
    await MockTransaction.updateOne({ transactionId: body.payment.transactionId }, { expiresAt: past });

    const res = await f.verifyPayment(customer, body.payment.transactionId);
    expect(res.body.payment.status).toBe("CANCELLED");
    const fresh = await f.createPayment(customer, order.id);
    expect(fresh.status).toBe(201);
    expect(fresh.body.payment.id).not.toBe(body.payment.id);
  });

  test("an expired session can't be paid at the provider either", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const { body } = await f.createPayment(customer, order.id);
    await MockTransaction.updateOne({ transactionId: body.payment.transactionId }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await f.mockPay(customer, body.payment.transactionId, "success");
    expect(res.status).toBe(400);
  });
});

describe("the provider's webhook", () => {
  let customer;
  let order;
  let payment;
  beforeEach(async () => {
    customer = await f.createUser();
    ({ order } = await newOrder(customer, { price: 20, qty: 2 }));
    payment = (await f.createPayment(customer, order.id)).body.payment;
  });

  test("a correctly signed success event settles the payment and confirms the order", async () => {
    const res = await f.postWebhook(f.paymentEvent({ payment }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect((await Payment.findById(payment.id)).status).toBe("PAID");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
  });

  test("a missing, wrong or wrong-length signature is rejected and changes nothing", async () => {
    const event = f.paymentEvent({ payment });
    for (const signature of ["", "deadbeef".repeat(8), "short", "0".repeat(64)]) {
      const res = await f.postWebhook(event, signature);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid webhook signature");
    }
    const raw = JSON.stringify(event);
    const none = await f.api().post("/api/payments/webhook").set("Content-Type", "application/json").send(raw);
    expect(none.status).toBe(400);
    expect((await Payment.findById(payment.id)).status).toBe("PENDING");
  });

  test("a signature made over a different body is rejected (tampered after signing)", async () => {
    const event = f.paymentEvent({ payment });
    const signature = f.webhookSignature(JSON.stringify(event));
    const tampered = JSON.stringify({ ...event, data: { ...event.data, amount: 0.01 } });
    expect((await f.postWebhook(tampered, signature)).status).toBe(400);
  });

  test("the same event delivered five times is processed once", async () => {
    const event = f.paymentEvent({ payment });
    for (let i = 0; i < 5; i += 1) expect((await f.postWebhook(event)).status).toBe(200);
    const stored = await Payment.findById(payment.id);
    expect(stored.processedEventIds).toEqual([event.id]);
    expect(await Commission.countDocuments({ order: order.id })).toBe(1);
    expect(await AuditLog.countDocuments({ order: order.id, action: "PAYMENT_PAID" })).toBe(1);
  });

  test("a validly signed event whose amount, order or currency doesn't match is ignored", async () => {
    const other = await newOrder(customer);
    for (const patch of [{ amount: 0.01 }, { orderId: other.order.id }, { currency: "EUR" }]) {
      const res = await f.postWebhook(f.paymentEvent({ payment, ...patch }));
      expect(res.status).toBe(200);
    }
    expect((await Payment.findById(payment.id)).status).toBe("PENDING");
    expect(await Order.findById(order.id).lean()).toMatchObject({ paymentStatus: "PENDING" });
  });

  test("unknown transactions and unknown event types are acknowledged and ignored", async () => {
    const ghost = f.paymentEvent({ payment: { ...payment, transactionId: "mock_txn_nope" } });
    expect((await f.postWebhook(ghost)).status).toBe(200);
    expect((await f.postWebhook({ id: "evt_x", type: "customer.created", data: {} })).status).toBe(200);
    expect((await f.postWebhook({ id: "evt_y", type: "constructor", data: {} })).status).toBe(200);
    expect((await Payment.findById(payment.id)).status).toBe("PENDING");
  });

  test("a signed event with an object as the transaction id can't match some other payment", async () => {
    const event = f.paymentEvent({ payment });
    event.data.transactionId = { $ne: null };
    expect((await f.postWebhook(event)).status).toBe(200);
    expect((await Payment.findById(payment.id)).status).toBe("PENDING");
  });

  test("an empty body or a body that isn't JSON is a clean 400", async () => {
    expect((await f.api().post("/api/payments/webhook")).status).toBe(400);
    expect((await f.postWebhook("not json at all")).status).toBe(400);
    expect((await f.postWebhook("")).status).toBe(400);
  });

  test("a failure event marks the payment FAILED but the order stays open for a retry", async () => {
    await f.postWebhook(f.paymentEvent({ payment, type: "payment.failed" }));
    expect((await Payment.findById(payment.id)).status).toBe("FAILED");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "PENDING", paymentStatus: "FAILED" });
  });

  test("a late failure event can't undo a payment that already succeeded", async () => {
    await f.postWebhook(f.paymentEvent({ payment }));
    await f.postWebhook(f.paymentEvent({ payment, type: "payment.failed" }));
    expect((await Payment.findById(payment.id)).status).toBe("PAID");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
  });

  test("a payment that arrives for an already-cancelled order is recorded as PAID but creates no commission", async () => {
    await Order.updateOne({ _id: order.id }, { status: "CANCELLED", paymentStatus: "CANCELLED" });
    await OrderItem.updateMany({ order: order.id }, { status: "CANCELLED" });
    await f.postWebhook(f.paymentEvent({ payment }));
    expect((await Payment.findById(payment.id)).status).toBe("PAID");
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CANCELLED", paymentStatus: "PAID" });
    expect(await Commission.countDocuments({ order: order.id })).toBe(0);
  });
});

describe("one payment, many callbacks at once", () => {
  test("verify and webhook racing settle it exactly once: one commission per item, one audit entry, stock untouched", async () => {
    const customer = await f.createUser();
    const { order, product } = await newOrder(customer, { price: 15, qty: 4, stock: 40 });
    const { body } = await f.createPayment(customer, order.id);
    await f.mockPay(customer, body.payment.transactionId, "success", false);
    const event = f.paymentEvent({ payment: body.payment });
    const stockBefore = (await Product.findById(product._id)).stock;

    const results = await Promise.all([
      f.verifyPayment(customer, body.payment.transactionId),
      f.postWebhook(event),
      f.verifyPayment(customer, body.payment.transactionId),
      f.postWebhook(event),
      f.postWebhook(f.paymentEvent({ payment: body.payment })),
    ]);
    for (const res of results) expect(res.status).toBeLessThan(500);

    expect((await Payment.findById(body.payment.id)).status).toBe("PAID");
    expect(await Commission.countDocuments({ order: order.id })).toBe(1);
    expect(await AuditLog.countDocuments({ order: order.id, action: "PAYMENT_PAID" })).toBe(1);
    expect(await Order.findById(order.id).lean()).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    expect((await Product.findById(product._id)).stock).toBe(stockBefore);
  });

  test("stock is deducted only at checkout, never by payment callbacks", async () => {
    const customer = await f.createUser();
    const product = await f.createProduct(vendor, { stock: 10 });
    const order = await f.placeOrder(customer, [[product, 3]]);
    expect((await Product.findById(product._id)).stock).toBe(7);
    const payment = await f.payOrder(customer, order.id);
    for (let i = 0; i < 3; i += 1) await f.verifyPayment(customer, payment.transactionId);
    await f.postWebhook(f.paymentEvent({ payment }));
    expect((await Product.findById(product._id)).stock).toBe(7);
  });

  test("a second commission for the same order item is impossible even by direct insert", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    await f.payOrder(customer, order.id);
    const existing = await Commission.findOne({ order: order.id }).lean();
    await expect(Commission.create({ ...existing, _id: undefined })).rejects.toMatchObject({ code: 11000 });
  });

  test("only one open payment per order is possible even by direct insert", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    await f.createPayment(customer, order.id);
    await expect(
      Payment.create({ order: order.id, user: customer.id, amount: 5, provider: "mock", transactionId: `dup_${f.unique()}`, status: "PENDING" }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe("the mock provider's test endpoint", () => {
  test("only works with the mock provider and only on your own payment", async () => {
    const customer = await f.createUser();
    const stranger = await f.createUser();
    const { order } = await newOrder(customer);
    const { body } = await f.createPayment(customer, order.id);

    expect((await f.mockPay(stranger, body.payment.transactionId)).status).toBe(404);
    expect((await f.mockPay(customer, body.payment.transactionId, "maybe")).status).toBe(400);
    expect((await f.api().post("/api/payments/mock/pay").set(f.bearer(customer.token)).send({ transactionId: body.payment.transactionId, outcome: "success", deliverWebhook: "yes" })).status).toBe(400);

    process.env.PAYMENT_PROVIDER = "stripe";
    try {
      expect((await f.mockPay(customer, body.payment.transactionId)).status).toBe(404);
    } finally {
      process.env.PAYMENT_PROVIDER = "mock";
    }
    expect((await Payment.findById(body.payment.id)).status).toBe("PENDING");
  });

  test("paying a session that is already settled is refused", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    const payment = await f.payOrder(customer, order.id);
    expect((await f.mockPay(customer, payment.transactionId)).status).toBe(400);
  });

  test("an unknown PAYMENT_PROVIDER fails loudly instead of silently picking a default", async () => {
    const customer = await f.createUser();
    const { order } = await newOrder(customer);
    process.env.PAYMENT_PROVIDER = "paypal";
    jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await f.createPayment(customer, order.id);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Internal server error" });
    } finally {
      process.env.PAYMENT_PROVIDER = "mock";
      console.error.mockRestore();
    }
  });
});

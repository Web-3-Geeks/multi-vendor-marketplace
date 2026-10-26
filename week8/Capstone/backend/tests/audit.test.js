const db = require("./helpers/db");
const f = require("./helpers/factory");
const AuditLog = require("../models/AuditLog");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

beforeAll(db.connect);
afterAll(db.disconnect);

let admin;
let vendor;
beforeAll(async () => {
  admin = await f.createAdmin();
  vendor = await f.createVendor();
});

const asAdmin = (method, path, body) => f.api()[method](`/api${path}`).set(f.bearer(admin.token)).send(body);
const entries = (filter) => AuditLog.find(filter).sort({ createdAt: 1 }).lean();
const setItemStatus = (v, orderId, status) => f.api().patch(`/api/vendor/orders/${orderId}/status`).set(f.bearer(v.token)).send({ status });

const placed = async (customer, opts = {}) => {
  const product = await f.createProduct(vendor, { price: 10, stock: 50, ...opts });
  return { product, order: await f.placeOrder(customer, [[product, 2]]) };
};

describe("what gets recorded", () => {
  test("a payment's whole story: created, paid (by webhook), order confirmed", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    const created = await f.createPayment(customer, order.id);
    const event = f.paymentEvent({ payment: created.body.payment });
    await f.postWebhook(event);

    const trail = await entries({ order: order.id });
    expect(trail.map((e) => e.action)).toEqual(["PAYMENT_CREATED", "PAYMENT_PAID", "ORDER_STATUS_CHANGED"]);

    const [createdEntry, paidEntry, confirmedEntry] = trail;
    expect(createdEntry).toMatchObject({ actorRole: "CUSTOMER", source: "api", metadata: { amount: 20, currency: "USD", provider: "mock" } });
    expect(String(createdEntry.actor)).toBe(customer.id);
    expect(paidEntry).toMatchObject({ actor: null, actorRole: "SYSTEM", source: "webhook", metadata: { eventId: event.id, amount: 20 } });
    expect(confirmedEntry.metadata).toMatchObject({ orderStatusFrom: "PENDING", orderStatusTo: "CONFIRMED", reason: "Payment confirmed" });
  });

  test("a payment confirmed by the customer's verify call is attributed to them", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    const { body } = await f.createPayment(customer, order.id);
    await f.mockPay(customer, body.payment.transactionId, "success", false);
    await f.verifyPayment(customer, body.payment.transactionId);
    const [paid] = await entries({ order: order.id, action: "PAYMENT_PAID" });
    expect(paid).toMatchObject({ source: "api", actorRole: "CUSTOMER" });
    expect(String(paid.actor)).toBe(customer.id);
  });

  test("failed payments and expired sessions are recorded", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    const { body } = await f.createPayment(customer, order.id);
    await f.mockPay(customer, body.payment.transactionId, "failure");
    expect(await entries({ order: order.id, action: "PAYMENT_FAILED" })).toHaveLength(1);

    const second = await placed(customer);
    const expiring = (await f.createPayment(customer, second.order.id)).body.payment;
    await Payment.updateOne({ _id: expiring.id }, { expiresAt: new Date(Date.now() - 5000) });
    await f.createPayment(customer, second.order.id);
    const [cancelled] = await entries({ order: second.order.id, action: "PAYMENT_CANCELLED" });
    expect(cancelled).toMatchObject({ source: "system", metadata: { reason: "Payment session expired" } });
  });

  test("vendor and admin order changes record who did what, with before and after", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    await f.payOrder(customer, order.id);
    await setItemStatus(vendor, order.id, "PROCESSING");
    await asAdmin("patch", `/admin/orders/${order.id}/status`, { status: "SHIPPED" });

    const changes = await entries({ order: order.id, action: "ORDER_STATUS_CHANGED", actorRole: { $in: ["VENDOR", "ADMIN"] } });
    expect(changes.map((c) => c.actorRole)).toEqual(["VENDOR", "ADMIN"]);
    expect(changes[0].metadata).toMatchObject({ itemStatus: "PROCESSING", orderStatusFrom: "CONFIRMED", orderStatusTo: "PROCESSING" });
    expect(String(changes[0].metadata.vendorId)).toBe(vendor.vendorId);
    expect(changes[1].metadata).toMatchObject({ itemStatus: "SHIPPED", orderStatusTo: "SHIPPED" });
  });

  test("a refund is recorded with the admin, the reason and the order cancellation it caused", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    const payment = await f.payOrder(customer, order.id);
    await asAdmin("post", `/admin/payments/${payment.id}/refund`, { reason: "Wrong item" });

    const trail = await entries({ order: order.id });
    const refunded = trail.find((e) => e.action === "PAYMENT_REFUNDED");
    expect(refunded).toMatchObject({ actorRole: "ADMIN", metadata: { reason: "Wrong item", amount: 20, cancelledItems: 1 } });
    expect(refunded.metadata.refundId).toMatch(/^mock_re_/);
    expect(trail.some((e) => e.action === "ORDER_STATUS_CHANGED" && e.metadata.reason === "Payment refunded" && e.metadata.orderStatusTo === "CANCELLED")).toBe(true);
  });

  test("an order auto-cancelled for being unpaid is attributed to the system", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    await f.backdateOrder(order.id, 25);
    await placed(await f.createUser());
    const [auto] = await entries({ order: order.id, action: "ORDER_AUTO_CANCELLED" });
    expect(auto).toMatchObject({ source: "system", actor: null, metadata: { reason: "Unpaid for 24 hours", orderStatusTo: "CANCELLED" } });
  });

  test("vendor approvals, category changes and product takedowns are recorded", async () => {
    const applicant = await f.createUser();
    const apply = await f.api().post("/api/vendors").set(f.bearer(applicant.token)).send({ storeName: `Audit Shop ${f.unique()}`, storeDescription: "x" });
    await asAdmin("patch", `/admin/vendors/${apply.body.vendor.id}/status`, { status: "APPROVED" });
    await asAdmin("patch", `/admin/vendors/${apply.body.vendor.id}/status`, { status: "SUSPENDED" });
    const vendorTrail = await entries({ entityType: "VENDOR", entityId: apply.body.vendor.id });
    expect(vendorTrail.map((e) => [e.metadata.from, e.metadata.to])).toEqual([["PENDING", "APPROVED"], ["APPROVED", "SUSPENDED"]]);
    expect(vendorTrail[0]).toMatchObject({ actorRole: "ADMIN", metadata: { storeName: expect.any(String) } });

    const created = await asAdmin("post", "/categories", { name: `Audit Cat ${f.unique()}` });
    await asAdmin("patch", `/categories/${created.body.category._id}`, { description: "changed" });
    await asAdmin("delete", `/categories/${created.body.category._id}`);
    const categoryTrail = await entries({ entityType: "CATEGORY", entityId: created.body.category._id });
    expect(categoryTrail.map((e) => e.action)).toEqual(["CATEGORY_CREATED", "CATEGORY_UPDATED", "CATEGORY_DELETED"]);

    const product = await f.createProduct(vendor);
    await asAdmin("patch", `/admin/products/${product._id}/status`, { status: "ARCHIVED" });
    await asAdmin("patch", `/admin/products/${product._id}/status`, { status: "ARCHIVED" });
    const productTrail = await entries({ entityType: "PRODUCT", entityId: product._id });
    expect(productTrail).toHaveLength(1);
    expect(productTrail[0].metadata).toMatchObject({ from: "ACTIVE", to: "ARCHIVED", takenDownByAdmin: true });
  });

  test("attempts that are refused leave no trace", async () => {
    const customer = await f.createUser();
    const { order } = await placed(customer);
    const payment = await f.payOrder(customer, order.id);
    const before = await AuditLog.countDocuments({ order: order.id });
    await asAdmin("patch", `/admin/orders/${order.id}/status`, { status: "CANCELLED" });
    await asAdmin("patch", `/admin/orders/${order.id}/status`, { status: "DELIVERED" });
    await f.api().post(`/api/admin/payments/${payment.id}/refund`).set(f.bearer(customer.token)).send({});
    await f.postWebhook(f.paymentEvent({ payment }), "bad-signature");
    expect(await AuditLog.countDocuments({ order: order.id })).toBe(before);
  });
});

describe("the log cannot be changed", () => {
  test.each([
    ["updateOne", () => AuditLog.updateOne({}, { action: "X" })],
    ["updateMany", () => AuditLog.updateMany({}, { source: "api" })],
    ["findOneAndUpdate", () => AuditLog.findOneAndUpdate({}, {})],
    ["findOneAndReplace", () => AuditLog.findOneAndReplace({}, {})],
    ["replaceOne", () => AuditLog.replaceOne({}, {})],
    ["deleteOne", () => AuditLog.deleteOne({})],
    ["deleteMany", () => AuditLog.deleteMany({})],
    ["findOneAndDelete", () => AuditLog.findOneAndDelete({})],
  ])("%s is refused", async (_name, attempt) => {
    await expect(attempt()).rejects.toThrow(/cannot be modified or deleted/);
  });

  test("entries have a creation time but no updated time", async () => {
    const [entry] = await entries({});
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.updatedAt).toBeUndefined();
  });
});

describe("reading the log", () => {
  let customer;
  let order;
  beforeAll(async () => {
    customer = await f.createUser();
    ({ order } = await placed(customer));
    await f.payOrder(customer, order.id);
    await setItemStatus(vendor, order.id, "PROCESSING");
  });

  test("is for admins only", async () => {
    expect((await f.api().get("/api/admin/audit-logs")).status).toBe(401);
    for (const user of [customer, vendor]) {
      expect((await f.api().get("/api/admin/audit-logs").set(f.bearer(user.token))).status).toBe(403);
    }
  });

  test("an order's timeline comes newest first, with the actor's name and role", async () => {
    const res = await asAdmin("get", `/admin/audit-logs?orderId=${order.id}&limit=50`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(4);
    const times = res.body.logs.map((l) => l.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(res.body.logs.find((l) => l.actorRole === "VENDOR").actor).toMatchObject({ email: vendor.email, role: "VENDOR" });
    expect(res.body.logs.find((l) => l.source === "webhook").actor).toBeNull();
  });

  test("filters by action, actor, source, entity and date", async () => {
    const byAction = await asAdmin("get", "/admin/audit-logs?action=PAYMENT_PAID&limit=50");
    expect(byAction.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(byAction.body.logs.every((l) => l.action === "PAYMENT_PAID")).toBe(true);

    const byActor = await asAdmin("get", `/admin/audit-logs?actor=${vendor.id}&limit=50`);
    expect(byActor.body.logs.every((l) => l.actor && l.actor.id === vendor.id)).toBe(true);

    const bySource = await asAdmin("get", "/admin/audit-logs?source=webhook&limit=50");
    expect(bySource.body.logs.every((l) => l.source === "webhook")).toBe(true);

    const byEntity = await asAdmin("get", `/admin/audit-logs?entityType=ORDER&entityId=${order.id}`);
    expect(byEntity.body.logs.every((l) => l.entityType === "ORDER" && l.entityId === order.id)).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    expect((await asAdmin("get", `/admin/audit-logs?from=${today}&to=${today}&limit=5`)).body.logs.length).toBeGreaterThan(0);
    expect((await asAdmin("get", "/admin/audit-logs?from=2999-01-01")).body.logs).toHaveLength(0);
  });

  test("is paginated", async () => {
    const res = await asAdmin("get", `/admin/audit-logs?orderId=${order.id}&limit=2&page=2`);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 2 });
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  test("never contains secrets or password data", async () => {
    const res = await asAdmin("get", "/admin/audit-logs?limit=50");
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(process.env.PAYMENT_WEBHOOK_SECRET);
    expect(text).not.toContain(process.env.JWT_SECRET);
    expect(text).not.toMatch(/password/i);
  });

  test.each(["entityType=NOPE", "action=NOPE", "source=NOPE", "orderId=xyz", "actor=1", "entityId=zz", "page=0", "limit=500", "from=notadate"])(
    "rejects ?%s with 400",
    async (query) => {
      expect((await asAdmin("get", `/admin/audit-logs?${query}`)).status).toBe(400);
    },
  );
});

const db = require("./helpers/db");
const f = require("./helpers/factory");

beforeAll(db.connect);
afterAll(db.disconnect);

let customer;
let vendor;
let admin;
beforeAll(async () => {
  customer = await f.createUser();
  vendor = await f.createVendor();
  admin = await f.createAdmin();
});

const BAD_ID = "not-an-object-id";
const UNKNOWN_ID = "507f1f77bcf86cd799439011";

describe("invalid ids are a 400 and unknown ids a 404, never a 500", () => {
  const as = (user) => (method, path, body) => f.api()[method](`/api${path}`).set(f.bearer(user.token)).send(body);

  test.each([
    ["customer", "get", `/orders/${BAD_ID}`, () => as(customer)],
    ["vendor", "get", `/vendor/products/${BAD_ID}`, () => as(vendor)],
    ["vendor", "get", `/vendor/orders/${BAD_ID}`, () => as(vendor)],
    ["vendor", "patch", `/vendor/orders/${BAD_ID}/status`, () => as(vendor), { status: "CANCELLED" }],
    ["vendor", "patch", `/vendor/products/${BAD_ID}`, () => as(vendor), { price: 5 }],
    ["vendor", "delete", `/vendor/products/${BAD_ID}`, () => as(vendor)],
    ["customer", "patch", `/cart/items/${BAD_ID}`, () => as(customer), { quantity: 1 }],
    ["customer", "delete", `/cart/items/${BAD_ID}`, () => as(customer)],
    ["customer", "get", `/payments/order/${BAD_ID}`, () => as(customer)],
    ["admin", "get", `/admin/vendors/${BAD_ID}`, () => as(admin)],
    ["admin", "patch", `/admin/vendors/${BAD_ID}/status`, () => as(admin), { status: "APPROVED" }],
    ["admin", "get", `/admin/orders/${BAD_ID}`, () => as(admin)],
    ["admin", "patch", `/admin/orders/${BAD_ID}/status`, () => as(admin), { status: "CANCELLED" }],
    ["admin", "get", `/admin/payments/${BAD_ID}`, () => as(admin)],
    ["admin", "post", `/admin/payments/${BAD_ID}/refund`, () => as(admin), {}],
    ["admin", "patch", `/admin/products/${BAD_ID}/status`, () => as(admin), { status: "ARCHIVED" }],
    ["admin", "patch", `/categories/${BAD_ID}`, () => as(admin), { name: "x" }],
    ["admin", "delete", `/categories/${BAD_ID}`, () => as(admin)],
  ])("%s %s %s with a malformed id -> 400", async (...row) => {
    const [, method, path, who, body] = row;
    const res = await who()(method, path, body);
    expect(res.status).toBe(400);
  });

  test.each([
    ["customer", "get", `/orders/${UNKNOWN_ID}`, () => as(customer)],
    ["vendor", "get", `/vendor/products/${UNKNOWN_ID}`, () => as(vendor)],
    ["vendor", "get", `/vendor/orders/${UNKNOWN_ID}`, () => as(vendor)],
    ["vendor", "patch", `/vendor/orders/${UNKNOWN_ID}/status`, () => as(vendor), { status: "CANCELLED" }],
    ["customer", "delete", `/cart/items/${UNKNOWN_ID}`, () => as(customer)],
    ["admin", "get", `/admin/vendors/${UNKNOWN_ID}`, () => as(admin)],
    ["admin", "get", `/admin/orders/${UNKNOWN_ID}`, () => as(admin)],
    ["admin", "get", `/admin/payments/${UNKNOWN_ID}`, () => as(admin)],
    ["admin", "post", `/admin/payments/${UNKNOWN_ID}/refund`, () => as(admin), {}],
    ["admin", "patch", `/admin/products/${UNKNOWN_ID}/status`, () => as(admin), { status: "ARCHIVED" }],
    ["admin", "delete", `/categories/${UNKNOWN_ID}`, () => as(admin)],
  ])("%s %s %s with an unknown id -> 404", async (...row) => {
    const [, method, path, who, body] = row;
    const res = await who()(method, path, body);
    expect(res.status).toBe(404);
  });

  test("public product and store lookups behave the same way", async () => {
    expect((await f.api().get(`/api/products/${BAD_ID}`)).status).toBe(400);
    expect((await f.api().get(`/api/products/${UNKNOWN_ID}`)).status).toBe(404);
    expect((await f.api().get(`/api/vendors/${UNKNOWN_ID}`)).status).toBe(404);
  });
});

describe("missing and wrong-typed fields", () => {
  test.each([
    ["register: empty body", "post", "/auth/register", {}],
    ["login: empty body", "post", "/auth/login", {}],
    ["apply as vendor: empty body", "post", "/vendors", {}],
    ["create product: empty body", "post", "/vendor/products", {}],
    ["create category: empty body", "post", "/categories", {}],
    ["add to cart: empty body", "post", "/cart/items", {}],
    ["checkout: empty body", "post", "/checkout", {}],
    ["create payment: empty body", "post", "/payments/create", {}],
    ["verify payment: empty body", "post", "/payments/verify", {}],
    ["mock pay: empty body", "post", "/payments/mock/pay", {}],
  ])("%s -> 400 with a field-level error list", async (_label, method, path, body) => {
    const token = path.startsWith("/vendor/products") ? vendor.token : path === "/categories" ? admin.token : path === "/vendors" ? (await f.createUser()).token : customer.token;
    const res = await f.api()[method](`/api${path}`).set(f.bearer(token)).send(body);
    expect(res.status).toBe(400);
    if (res.body.errors) {
      for (const error of res.body.errors) expect(error).toEqual({ field: expect.any(String), message: expect.any(String) });
    }
  });

  test("validation errors list every problem at once, naming each field", async () => {
    const res = await f.api().post("/api/auth/register").send({ name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation Failed");
    expect([...new Set(res.body.errors.map((e) => e.field))].sort()).toEqual(["email", "name", "password"]);
  });

  test("a JSON array or a bare string where an object is expected is rejected", async () => {
    for (const payload of ["[]", '"text"', "123", "null"]) {
      const res = await f.api().post("/api/auth/login").set("Content-Type", "application/json").send(payload);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  });

  test("paging parameters are checked everywhere they exist", async () => {
    const lists = [
      ["/products", null],
      ["/vendors", null],
      ["/orders", customer],
      ["/vendor/orders", vendor],
      ["/vendor/products", vendor],
      ["/vendor/earnings", vendor],
      ["/admin/vendors", admin],
      ["/admin/orders", admin],
      ["/admin/payments", admin],
      ["/admin/products", admin],
      ["/admin/audit-logs", admin],
    ];
    for (const [path, user] of lists) {
      for (const bad of ["page=0", "page=-1", "page=abc", "limit=0", "limit=51", "limit=abc"]) {
        const req = f.api().get(`/api${path}?${bad}`);
        const res = await (user ? req.set(f.bearer(user.token)) : req);
        expect({ path, bad, status: res.status }).toEqual({ path, bad, status: 400 });
      }
    }
  });
});

describe("unexpected server errors", () => {
  const fail = (target, method) => jest.spyOn(target, method).mockImplementation(() => {
    throw new Error("database exploded: mongodb://user:secret@host/db");
  });

  test("any unhandled error becomes a generic 500 and is logged server-side only", async () => {
    const Category = require("../models/Category");
    const spy = fail(Category, "find");
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await f.api().get("/api/categories");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: "Internal server error" });
      expect(log).toHaveBeenCalled();
      expect(res.text).not.toMatch(/secret|mongodb:/);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });

  test("an application error carries its own status and message", async () => {
    const res = await f.api().post("/api/payments/create").set(f.bearer(customer.token)).send({ orderId: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Order not found" });
  });

  test("the server keeps working after an error", async () => {
    const Category = require("../models/Category");
    const spy = fail(Category, "find");
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    await f.api().get("/api/categories");
    spy.mockRestore();
    log.mockRestore();
    expect((await f.api().get("/api/categories")).status).toBe(200);
  });
});

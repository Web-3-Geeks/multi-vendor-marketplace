const db = require("./helpers/db");
const f = require("./helpers/factory");

beforeAll(db.connect);
afterAll(db.disconnect);

const ANY = ["CUSTOMER", "VENDOR", "ADMIN"];

// [method, path, roles that may call it]
const ENDPOINTS = [
  ["get", "/api/customer/dashboard", ["CUSTOMER"]],
  ["get", "/api/vendor/dashboard", ["VENDOR"]],
  ["get", "/api/admin/dashboard", ["ADMIN"]],
  ["get", "/api/auth/me", ANY],
  ["get", "/api/vendors/me", ANY],
  ["post", "/api/vendors", ["CUSTOMER"]],
  ["get", "/api/cart", ANY],
  ["get", "/api/orders", ANY],
  ["get", "/api/vendor/products", ["VENDOR"]],
  ["post", "/api/vendor/products", ["VENDOR"]],
  ["get", "/api/vendor/orders", ["VENDOR"]],
  ["get", "/api/vendor/earnings", ["VENDOR"]],
  ["post", "/api/categories", ["ADMIN"]],
  ["get", "/api/admin/vendors", ["ADMIN"]],
  ["get", "/api/admin/orders", ["ADMIN"]],
  ["get", "/api/admin/payments", ["ADMIN"]],
  ["get", "/api/admin/stats", ["ADMIN"]],
  ["get", "/api/admin/products", ["ADMIN"]],
  ["get", "/api/admin/audit-logs", ["ADMIN"]],
];

const PUBLIC = [
  ["get", "/api/health"],
  ["get", "/api/products"],
  ["get", "/api/categories"],
  ["get", "/api/vendors"],
];

describe("role based access control", () => {
  const people = {};
  beforeAll(async () => {
    people.CUSTOMER = await f.createUser();
    people.VENDOR = await f.createVendor();
    people.ADMIN = await f.createAdmin();
  });

  test.each(ENDPOINTS)("%s %s: anonymous callers get 401", async (method, path) => {
    const res = await f.api()[method](path).send({});
    expect(res.status).toBe(401);
  });

  describe.each(ENDPOINTS)("%s %s", (method, path, allowed) => {
    test.each(ANY)("as %s", async (role) => {
      const res = await f.api()[method](path).set(f.bearer(people[role].token)).send({});
      if (allowed.includes(role)) {
        expect([401, 403]).not.toContain(res.status);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });

  test.each(PUBLIC)("%s %s needs no login", async (method, path) => {
    const res = await f.api()[method](path);
    expect(res.status).toBe(200);
  });

  test("a vendor whose store is not approved is blocked from vendor features", async () => {
    for (const status of ["PENDING", "SUSPENDED", "REJECTED"]) {
      const vendor = await f.createVendor({ status });
      for (const path of ["/api/vendor/products", "/api/vendor/orders", "/api/vendor/earnings"]) {
        const res = await f.api().get(path).set(f.bearer(vendor.token));
        expect(res.status).toBe(403);
      }
    }
  });

  test("an unknown route is a clean 404", async () => {
    const res = await f.api().get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Route not found" });
  });

  test("shopping (cart, checkout, orders) is open to every signed-in role", async () => {
    for (const role of ANY) {
      expect((await f.api().get("/api/cart").set(f.bearer(people[role].token))).status).toBe(200);
      expect((await f.api().get("/api/orders").set(f.bearer(people[role].token))).status).toBe(200);
    }
  });
});

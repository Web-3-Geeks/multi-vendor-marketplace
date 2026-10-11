// Fills a database with a realistic demo marketplace by driving the real API:
// vendors with stores, categories, products with photos, customers, and orders that
// go through checkout, payment and fulfilment (so commissions, stock and the audit log
// are all genuine). Safe to run again: anything that already exists is skipped.
//
//   API_URL=http://localhost:5000/api ADMIN_PASSWORD=... DEMO_PASSWORD=... npm run seed:demo
//
// Product data and photos come from https://dummyjson.com (snapshot in demoData.json).
// Use a server with RATE_LIMIT_DISABLED=true (the script registers a dozen accounts) and
// PAYMENT_PROVIDER=mock (it pays through the mock provider).
const data = require("./demoData.json");

const API = process.env.API_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
const PASSWORD = process.env.DEMO_PASSWORD;

const call = async (method, path, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const must = (res, what) => {
  if (res.status >= 400) throw new Error(`${what} failed (${res.status}): ${res.data.message || JSON.stringify(res.data)}`);
  return res.data;
};

const login = async (email, password) => {
  const res = await call("POST", "/auth/login", { body: { email, password } });
  return res.status === 200 ? res.data.token : null;
};

// Logs in, or registers first when the account does not exist yet.
const ensureAccount = async ({ name, email }) => {
  let token = await login(email, PASSWORD);
  if (token) return { token, created: false };
  const registered = await call("POST", "/auth/register", { body: { name, email, password: PASSWORD } });
  if (registered.status !== 201) throw new Error(`Cannot create ${email} (${registered.status}): ${registered.data.message}. If it exists, its password differs from DEMO_PASSWORD.`);
  token = await login(email, PASSWORD);
  return { token, created: true };
};

const log = (msg) => console.log(msg);

async function main() {
  if (!ADMIN_PASSWORD || !PASSWORD) {
    console.error("Set ADMIN_PASSWORD (the seeded admin's) and DEMO_PASSWORD (the password the demo accounts get).");
    process.exit(2);
  }
  const health = await call("GET", "/health");
  if (health.status !== 200) throw new Error(`The API at ${API} is not healthy: ${JSON.stringify(health.data)}`);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!admin) throw new Error("Admin login failed");

  // ---- categories ----
  const existing = must(await call("GET", "/categories"), "list categories").categories;
  const categoryId = {};
  for (const c of data.categories) {
    const found = existing.find((e) => e.name === c.name);
    if (found) categoryId[c.key] = found._id;
    else categoryId[c.key] = must(await call("POST", "/categories", { token: admin, body: { name: c.name, description: c.description } }), `create category ${c.name}`).category._id;
  }
  log(`categories: ${data.categories.length} ready`);

  // ---- vendors, stores, products ----
  const vendorToken = {};
  const productId = {};
  for (const store of data.stores) {
    const { token } = await ensureAccount(store.vendor);
    let application = (await call("GET", "/vendors/me", { token })).data.vendor;
    if (!application) {
      const applied = must(await call("POST", "/vendors", { token, body: { storeName: store.storeName, storeDescription: store.storeDescription } }), `apply ${store.storeName}`);
      application = applied.vendor;
    }
    const vendorId = application.id || application._id;
    if (application.status !== "APPROVED") {
      must(await call("PATCH", `/admin/vendors/${vendorId}/status`, { token: admin, body: { status: "APPROVED" } }), `approve ${store.storeName}`);
    }
    vendorToken[store.key] = await login(store.vendor.email, PASSWORD);

    const have = must(await call("GET", "/vendor/products?limit=50", { token: vendorToken[store.key] }), "list products").products;
    productId[store.key] = [];
    for (const p of store.products) {
      const found = have.find((h) => h.name === p.name);
      if (found) { productId[store.key].push(found.id || found._id); continue; }
      const created = must(await call("POST", "/vendor/products", {
        token: vendorToken[store.key],
        body: { name: p.name, description: p.description, price: p.price, stock: p.stock, category: categoryId[store.category], images: p.images, status: "ACTIVE" },
      }), `create ${p.name}`);
      productId[store.key].push(created.product.id || created.product._id);
    }
    log(`store: ${store.storeName} (${store.vendor.name}) with ${store.products.length} products`);
  }

  // ---- customers ----
  const customerToken = [];
  for (const c of data.customers) {
    customerToken.push((await ensureAccount(c)).token);
  }
  log(`customers: ${data.customers.length} ready`);

  // ---- orders ----
  const already = (await Promise.all(customerToken.map((token) => call("GET", "/orders?limit=1", { token })))).some((r) => (r.data.pagination?.total || 0) > 0);
  if (already) {
    log("orders: skipped (the demo customers already have orders)");
    return;
  }

  const pay = async (token, orderId, outcome) => {
    const created = must(await call("POST", "/payments/create", { token, body: { orderId } }), "create payment").payment;
    must(await call("POST", "/payments/mock/pay", { token, body: { transactionId: created.transactionId, outcome } }), `mock ${outcome}`);
    const verified = must(await call("POST", "/payments/verify", { token, body: { transactionId: created.transactionId } }), "verify payment").payment;
    return verified;
  };

  const advance = async (orderId, vendorKeys, steps) => {
    for (const status of steps) {
      for (const key of vendorKeys) {
        must(await call("PATCH", `/vendor/orders/${orderId}/status`, { token: vendorToken[key], body: { status } }), `${key} -> ${status}`);
      }
    }
  };

  const FLOW = { processing: ["PROCESSING"], shipped: ["PROCESSING", "SHIPPED"], delivered: ["PROCESSING", "SHIPPED", "DELIVERED"] };
  const tally = {};
  for (const spec of data.orders) {
    const token = customerToken[spec.customer];
    for (const [storeKey, index, quantity] of spec.lines) {
      must(await call("POST", "/cart/items", { token, body: { productId: productId[storeKey][index], quantity } }), "add to cart");
    }
    const order = must(await call("POST", "/checkout", { token, body: { shippingAddress: data.customers[spec.customer].address } }), "checkout").order;
    const vendorKeys = [...new Set(spec.lines.map(([k]) => k))];

    if (spec.outcome === "failed-then-paid") {
      await pay(token, order.id, "failure");
      await pay(token, order.id, "success");
    } else if (spec.outcome !== "unpaid") {
      const payment = await pay(token, order.id, "success");
      if (FLOW[spec.outcome]) await advance(order.id, vendorKeys, FLOW[spec.outcome]);
      if (spec.outcome === "refunded") {
        must(await call("POST", `/admin/payments/${payment.id}/refund`, { token: admin, body: { reason: "Customer changed their mind" } }), "refund");
      }
    }
    tally[spec.outcome] = (tally[spec.outcome] || 0) + 1;
  }
  log(`orders: ${data.orders.length} placed ${JSON.stringify(tally)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

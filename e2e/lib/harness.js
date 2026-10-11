const { chromium } = require("playwright-core");

const config = {
  api: process.env.E2E_API_URL || "http://localhost:5000/api",
  web: process.env.E2E_WEB_URL || "http://localhost:5173",
  adminEmail: process.env.E2E_ADMIN_EMAIL || "admin@test.com",
  adminPassword: process.env.E2E_ADMIN_PASSWORD,
  // Either point at a browser binary, or name an installed channel ("msedge", "chrome").
  browserPath: process.env.E2E_BROWSER_PATH,
  channel: process.env.E2E_BROWSER_CHANNEL || "msedge",
  headed: process.env.E2E_HEADED === "true",
  password: "Passw0rd123",
  tag: Date.now(),
};

const ADDRESS = {
  fullName: "Test Buyer",
  phone: "+92 300 1234567",
  line1: "12 Garden Road",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

// A tiny API client for test setup. Everything a test needs besides the UI under test is
// created through the public API, so the suite needs no database access.
async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(config.api + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function login(email, password) {
  const res = await call("POST", "/auth/login", { body: { email, password } });
  if (res.status !== 200) throw new Error(`Login failed for ${email} (${res.status}): ${res.data.message}`);
  return res.data.token;
}

async function registerCustomer(label) {
  const email = `e2e-${label}-${config.tag}@test.com`;
  const res = await call("POST", "/auth/register", { body: { name: `E2E ${label}`, email, password: config.password } });
  if (res.status !== 201) throw new Error(`Register failed (${res.status}): ${res.data.message}`);
  return { email, name: `E2E ${label}`, token: await login(email, config.password) };
}

// Registers a customer, applies for a store, has the admin approve it, and returns a
// vendor token (the role is read on login, so we log in again after approval).
async function createVendor(label, adminToken) {
  const user = await registerCustomer(label);
  const store = `E2E Store ${label} ${config.tag}`;
  const applied = await call("POST", "/vendors", { token: user.token, body: { storeName: store, storeDescription: "created by the e2e suite" } });
  if (applied.status !== 201) throw new Error(`Vendor application failed (${applied.status}): ${applied.data.message}`);
  const approved = await call("PATCH", `/admin/vendors/${applied.data.vendor.id}/status`, { token: adminToken, body: { status: "APPROVED" } });
  if (approved.status !== 200) throw new Error(`Vendor approval failed (${approved.status}): ${approved.data.message}`);
  return { ...user, store, vendorId: applied.data.vendor.id, token: await login(user.email, config.password) };
}

async function createCategory(adminToken, name) {
  const res = await call("POST", "/categories", { token: adminToken, body: { name } });
  if (res.status !== 201) throw new Error(`Category failed (${res.status}): ${res.data.message}`);
  return res.data.category;
}

async function createProduct(vendorToken, categoryId, name, price, stock = 50) {
  const res = await call("POST", "/vendor/products", {
    token: vendorToken,
    body: { name: `${name} ${config.tag}`, description: "e2e product", price, stock, category: categoryId, status: "ACTIVE" },
  });
  if (res.status !== 201) throw new Error(`Product failed (${res.status}): ${res.data.message}`);
  return { id: res.data.product._id, name: `${name} ${config.tag}` };
}

async function placeOrder(token, lines) {
  for (const [productId, quantity] of lines) await call("POST", "/cart/items", { token, body: { productId, quantity } });
  const res = await call("POST", "/checkout", { token, body: { shippingAddress: ADDRESS } });
  if (res.status !== 201) throw new Error(`Checkout failed (${res.status}): ${res.data.message}`);
  return res.data.order;
}

async function payOrder(token, orderId) {
  const created = await call("POST", "/payments/create", { token, body: { orderId } });
  await call("POST", "/payments/mock/pay", { token, body: { transactionId: created.data.payment.transactionId, outcome: "success" } });
  return call("POST", "/payments/verify", { token, body: { transactionId: created.data.payment.transactionId } });
}

// Two approved stores with one product each, plus an admin token. Used by run.js and screenshots.js.
async function createWorld() {
  const adminToken = await login(config.adminEmail, config.adminPassword);
  const vendorA = await createVendor("A", adminToken);
  const vendorB = await createVendor("B", adminToken);
  const category = await createCategory(adminToken, `E2E Category ${config.tag}`);
  return {
    adminToken, vendorA, vendorB, category,
    mouse: await createProduct(vendorA.token, category._id, "E2E Mouse", 40),
    keyboard: await createProduct(vendorB.token, category._id, "E2E Keyboard", 25),
  };
}

async function launch() {
  const options = { headless: !config.headed };
  if (config.browserPath) options.executablePath = config.browserPath;
  else options.channel = config.channel;
  return chromium.launch(options);
}

// Collects pass/fail lines and the browser console errors seen during a run.
function createRun(browser) {
  const results = [];
  const consoleErrors = [];

  const check = (name, condition, detail = "") => {
    results.push({ name, ok: !!condition });
    console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : detail ? `  -> ${detail}` : ""}`);
  };

  const newPage = async (viewport = { width: 1280, height: 900 }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    return page;
  };

  const uiLogin = async (page, email, password = config.password) => {
    await page.goto(`${config.web}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/auth/login")),
      page.getByRole("button", { name: "Log in" }).click(),
    ]);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  };

  const visible = (page, text, timeout = 20000) =>
    page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout }).then(() => true).catch(() => false);
  const absent = async (page, text) => (await page.getByText(text, { exact: false }).count()) === 0;
  const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  return { results, consoleErrors, check, newPage, uiLogin, visible, absent, noHorizontalScroll };
}

module.exports = {
  config, ADDRESS, call, login, registerCustomer, createVendor, createCategory, createProduct,
  placeOrder, payOrder, createWorld, launch, createRun,
};

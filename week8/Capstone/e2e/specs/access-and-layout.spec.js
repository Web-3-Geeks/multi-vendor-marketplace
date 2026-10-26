// Route guards per role, and that the main pages fit tablet and phone widths.
const h = require("../lib/harness");

module.exports = async function accessAndLayout({ run, world }) {
  const { check, newPage, uiLogin, visible, noHorizontalScroll } = run;
  const customer = world.customer || (await h.registerCustomer("layout"));

  const guest = await newPage();
  for (const path of ["/customer", "/vendor", "/admin", "/orders", "/checkout"]) {
    await guest.goto(`${h.config.web}${path}`);
    await guest.waitForURL("**/login");
    check(`guard: a signed-out visitor opening ${path} is sent to /login`, guest.url().endsWith("/login"));
  }

  const buyer = await newPage();
  await uiLogin(buyer, customer.email);
  await buyer.goto(`${h.config.web}/admin`);
  await buyer.waitForURL("**/customer");
  check("guard: a customer opening /admin is sent back to their own dashboard", buyer.url().endsWith("/customer"));
  await buyer.goto(`${h.config.web}/login`);
  await buyer.waitForURL("**/customer");
  check("guard: a signed-in user opening /login is sent to their dashboard", buyer.url().endsWith("/customer"));

  const vendor = await newPage();
  await uiLogin(vendor, world.vendorA.email);
  await vendor.goto(`${h.config.web}/admin`);
  await vendor.waitForURL("**/vendor");
  check("guard: a vendor opening /admin is sent back to the vendor dashboard", vendor.url().endsWith("/vendor"));

  await h.call("POST", "/cart/items", { token: customer.token, body: { productId: world.keyboard.id, quantity: 1 } });
  for (const [viewport, label] of [[{ width: 768, height: 1024 }, "tablet 768px"], [{ width: 375, height: 800 }, "phone 375px"]]) {
    const page = await newPage(viewport);
    await uiLogin(page, customer.email);
    const overflowing = [];
    for (const path of ["/products", "/cart", "/checkout", "/orders", "/customer"]) {
      await page.goto(`${h.config.web}${path}`);
      await visible(page, "Marketplace").catch(() => {});
      await page.waitForTimeout(800);
      if (!(await noHorizontalScroll(page))) overflowing.push(path);
    }
    check(`layout (${label}): customer pages have no horizontal scroll`, overflowing.length === 0, overflowing.join(", "));

    const v = await newPage(viewport);
    await uiLogin(v, world.vendorA.email);
    await v.waitForTimeout(2000);
    check(`layout (${label}): the vendor dashboard has no horizontal scroll`, await noHorizontalScroll(v));

    const a = await newPage(viewport);
    await uiLogin(a, h.config.adminEmail, h.config.adminPassword);
    await a.waitForTimeout(3000);
    check(`layout (${label}): the admin dashboard has no horizontal scroll`, await noHorizontalScroll(a));
    if (viewport.width === 375) {
      await a.getByRole("button", { name: "Open menu" }).click();
      check("layout (phone): the sidebar opens as a menu with the admin links", await a.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Activity" }).isVisible());
      await a.keyboard.press("Escape");
      check("layout (phone): Escape closes the menu", (await a.getByRole("dialog", { name: "Menu" }).count()) === 0);
    }
  }
};

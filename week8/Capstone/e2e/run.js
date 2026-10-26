// Runs every spec in e2e/specs against a running app. See e2e/README.md.
const fs = require("fs");
const path = require("path");
const h = require("./lib/harness");

async function main() {
  if (!h.config.adminPassword) {
    console.error("Set E2E_ADMIN_PASSWORD (the seeded admin's password). See e2e/README.md.");
    process.exit(2);
  }
  const health = await fetch(`${h.config.api}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Backend not reachable at ${h.config.api}/health. Start it first (or set E2E_API_URL).`);
    process.exit(2);
  }

  const only = process.argv[2];
  const specs = fs.readdirSync(path.join(__dirname, "specs")).filter((f) => f.endsWith(".spec.js") && (!only || f.includes(only))).sort();

  const browser = await h.launch();
  const run = h.createRun(browser);
  let crashed = false;

  try {
    const world = await h.createWorld();

    for (const file of specs) {
      console.log(`\n== ${file} ==`);
      try {
        await require(path.join(__dirname, "specs", file))({ run, world });
      } catch (err) {
        crashed = true;
        run.check(`${file} ran to completion`, false, err.message.split("\n")[0]);
      }
    }
    run.check("no console errors in the browser during the run", run.consoleErrors.length === 0, run.consoleErrors.slice(0, 3).join(" | "));
  } catch (err) {
    crashed = true;
    console.error("Setup failed:", err.message);
  } finally {
    await browser.close();
  }

  const passed = run.results.filter((r) => r.ok).length;
  console.log(`\nRESULT: ${passed}/${run.results.length} checks passed`);
  process.exit(crashed || passed !== run.results.length ? 1 : 0);
}

main();

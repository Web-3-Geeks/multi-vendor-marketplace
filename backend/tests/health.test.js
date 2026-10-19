// /api/health is what uptime monitoring and the Docker healthcheck watch, so it must
// tell the truth when the database is gone (the happy path lives in security.test.js).
const mongoose = require("mongoose");
const db = require("./helpers/db");
const f = require("./helpers/factory");
const app = require("../expressApp");

beforeAll(db.connect);
afterAll(async () => {
  app.locals.dbError = null;
  await db.disconnect();
});

describe("health check with the database down", () => {
  beforeAll(() => mongoose.disconnect());
  // Reconnect so the last test (and afterAll) see a healthy app again.
  afterAll(() => db.connect());

  test("answers 503 degraded, so monitors and Docker mark the service unhealthy", async () => {
    const res = await f.api().get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "disconnected" });
    expect(res.body.uptime).toEqual(expect.any(Number));
  });

  test("includes the reason of the last failed connection attempt", async () => {
    app.locals.dbError = "MongoServerSelectionError: connection timed out";
    const res = await f.api().get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe("MongoServerSelectionError: connection timed out");
  });
});

describe("health check after the database comes back", () => {
  test("is 200 again and hides the old failure reason", async () => {
    app.locals.dbError = "MongoServerSelectionError: connection timed out";
    const res = await f.api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "connected" });
    expect(res.body).not.toHaveProperty("reason");
  });
});

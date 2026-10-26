const jwt = require("jsonwebtoken");
const db = require("./helpers/db");
const f = require("./helpers/factory");
const User = require("../models/User");

beforeAll(db.connect);
afterAll(db.disconnect);

const register = (body) => f.api().post("/api/auth/register").send(body);
const login = (body) => f.api().post("/api/auth/login").send(body);
const newEmail = () => `person-${f.unique()}@test.com`;

describe("registration", () => {
  test("creates a customer and never returns the password", async () => {
    const email = newEmail();
    const res = await register({ name: "Ayesha Khan", email, password: "Passw0rd123" });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Ayesha Khan", email, role: "CUSTOMER" });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test("always forces the CUSTOMER role, whatever the client asks for", async () => {
    const res = await register({ name: "Sneaky", email: newEmail(), password: "Passw0rd123", role: "ADMIN" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CUSTOMER");
    const stored = await User.findById(res.body.user.id);
    expect(stored.role).toBe("CUSTOMER");
  });

  test("stores a bcrypt hash, not the password", async () => {
    const email = newEmail();
    await register({ name: "Hash Check", email, password: "Passw0rd123" });
    const stored = await User.findOne({ email }).select("+password");
    expect(stored.password).not.toBe("Passw0rd123");
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  test("rejects a duplicate email, even in a different letter case", async () => {
    const email = newEmail();
    await register({ name: "First", email, password: "Passw0rd123" });
    const again = await register({ name: "Second", email: email.toUpperCase(), password: "Passw0rd123" });
    expect(again.status).toBe(409);
  });

  test.each([
    ["missing name", { email: "a@test.com", password: "Passw0rd123" }],
    ["missing email", { name: "A", password: "Passw0rd123" }],
    ["missing password", { name: "A", email: "a@test.com" }],
    ["invalid email", { name: "A", email: "not-an-email", password: "Passw0rd123" }],
    ["password too short", { name: "A", email: "a@test.com", password: "Pa55" }],
    ["password without a number", { name: "A", email: "a@test.com", password: "OnlyLetters" }],
    ["password without a letter", { name: "A", email: "a@test.com", password: "12345678" }],
    ["password too long", { name: "A", email: "a@test.com", password: `A1${"x".repeat(80)}` }],
    ["name too long", { name: "x".repeat(101), email: "a@test.com", password: "Passw0rd123" }],
    ["name not text", { name: { $ne: "" }, email: "a@test.com", password: "Passw0rd123" }],
    ["email not text", { name: "A", email: { $gt: "" }, password: "Passw0rd123" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation Failed");
  });
});

describe("login", () => {
  let user;
  beforeAll(async () => {
    user = await f.createUser();
  });

  test("returns a token and the user", async () => {
    const res = await login({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: user.email, role: "CUSTOMER" });
  });

  test("the token carries only the user id (the role is read from the database on every request)", async () => {
    const res = await login({ email: user.email, password: user.password });
    const payload = jwt.decode(res.body.token);
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "id"]);
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });

  test("wrong password and unknown email get the same 401 (no account enumeration)", async () => {
    const wrongPassword = await login({ email: user.email, password: "Wrong-password-1" });
    const unknownEmail = await login({ email: newEmail(), password: "Passw0rd123" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  test("email matching ignores letter case", async () => {
    const res = await login({ email: user.email.toUpperCase(), password: user.password });
    expect(res.status).toBe(200);
  });

  test.each([
    ["missing password", (u) => ({ email: u.email })],
    ["missing email", (u) => ({ password: u.password })],
    ["object instead of a password", (u) => ({ email: u.email, password: { $ne: "" } })],
    ["object instead of an email", (u) => ({ email: { $ne: "" }, password: u.password })],
  ])("rejects %s with 400", async (_label, build) => {
    const res = await login(build(user));
    expect(res.status).toBe(400);
  });
});

describe("authenticated requests", () => {
  let user;
  beforeAll(async () => {
    user = await f.createUser();
  });

  test("/me returns the current user and no password", async () => {
    const res = await f.api().get("/api/auth/me").set(f.bearer(user.token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test("no token, a malformed header, a garbage token or a tampered token are all 401", async () => {
    const [none, malformed, garbage, tampered] = await Promise.all([
      f.api().get("/api/auth/me"),
      f.api().get("/api/auth/me").set("Authorization", user.token),
      f.api().get("/api/auth/me").set(f.bearer("not.a.token")),
      f.api().get("/api/auth/me").set(f.bearer(`${user.token.slice(0, -2)}xx`)),
    ]);
    for (const res of [none, malformed, garbage, tampered]) expect(res.status).toBe(401);
  });

  test("a token signed with a different secret is rejected", async () => {
    const forged = jwt.sign({ id: user.id }, "some-other-secret", { expiresIn: "1d" });
    const res = await f.api().get("/api/auth/me").set(f.bearer(forged));
    expect(res.status).toBe(401);
  });

  test("an expired token is rejected", async () => {
    const expired = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await f.api().get("/api/auth/me").set(f.bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired|invalid/i);
  });

  test("a valid token for a user that no longer exists is rejected", async () => {
    const ghost = await f.createUser();
    await User.deleteOne({ _id: ghost.id });
    const res = await f.api().get("/api/auth/me").set(f.bearer(ghost.token));
    expect(res.status).toBe(401);
  });

  test("a role change in the database takes effect immediately, without a new token", async () => {
    const promoted = await f.createUser();
    expect((await f.api().get("/api/admin/stats").set(f.bearer(promoted.token))).status).toBe(403);
    await User.updateOne({ _id: promoted.id }, { role: "ADMIN" });
    expect((await f.api().get("/api/admin/stats").set(f.bearer(promoted.token))).status).toBe(200);
  });

  test("logout acknowledges (tokens are stateless and simply discarded by the client)", async () => {
    const res = await f.api().post("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

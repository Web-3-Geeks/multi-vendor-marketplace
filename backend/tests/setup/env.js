// Runs in every test file before anything else is loaded, so the app reads these values.
const uri = process.env.TEST_MONGO_URI;

// Never let a test run against a real database.
const databaseName = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).pathname.replace("/", "");
if (!databaseName.endsWith("_test")) {
  throw new Error(`Refusing to run tests against database "${databaseName}": its name must end in "_test"`);
}

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: uri,
  JWT_SECRET: "jest-secret-for-tests-only",
  FRONTEND_URL: "http://localhost:5173",
  PAYMENT_PROVIDER: "mock",
  PAYMENT_PUBLIC_KEY: "pk_test_jest",
  PAYMENT_SECRET_KEY: "sk_test_jest_secret",
  PAYMENT_WEBHOOK_SECRET: "whsec_jest_webhook_secret",
  COMMISSION_RATE: "0.10",
  RATE_LIMIT_DISABLED: "true",
  REQUEST_LOG: "off",
});

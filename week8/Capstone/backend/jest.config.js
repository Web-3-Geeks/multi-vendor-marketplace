// Tests run against an in-memory MongoDB replica set (transactions work, nothing
// outside the test process is touched), or against TEST_DATABASE_URL if you set one
// (its database name must end in "_test").
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  testTimeout: 60000,
  maxWorkers: 1,
  verbose: true,
};

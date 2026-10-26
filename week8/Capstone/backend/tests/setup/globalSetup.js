const { MongoMemoryReplSet } = require("mongodb-memory-server");

module.exports = async () => {
  if (process.env.TEST_DATABASE_URL) {
    process.env.TEST_MONGO_URI = process.env.TEST_DATABASE_URL;
    return;
  }

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.TEST_MONGO_URI = replSet.getUri("marketplace_test");
};

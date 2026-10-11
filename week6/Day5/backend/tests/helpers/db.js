const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const modelsDir = path.join(__dirname, "..", "..", "models");
const models = fs
  .readdirSync(modelsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => require(path.join(modelsDir, file)));

// Connects, makes sure every index (unique constraints included) exists, and starts
// from empty collections.
// Jest's sandbox can't run the driver's dynamic import('os'), which leaves the connection handshake
// without its client metadata. Handing the driver the os module directly avoids that.
const connect = async () => {
  await mongoose.connect(process.env.DATABASE_URL, { runtimeAdapters: { os: require("os") } });
  await Promise.all(models.map((model) => model.init()));
  // Through the raw collections: the AuditLog model (rightly) refuses deleteMany.
  await Promise.all(models.map((model) => model.collection.deleteMany({})));
};

const disconnect = () => mongoose.disconnect();

module.exports = { connect, disconnect, models };

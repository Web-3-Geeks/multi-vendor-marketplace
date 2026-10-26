// Creates every collection and index the application relies on (unique emails,
// one open payment per order, one commission per order item, query indexes...).
//
//   npm run db:setup            safe: only adds missing indexes
//   npm run db:setup -- --prune also drops indexes that are no longer in the schemas
//
// Production does not build indexes on server start (autoIndex is off there), so run
// this once against a new database and again after any deploy that adds an index.
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const modelsDir = path.join(__dirname, "..", "models");
const models = fs
  .readdirSync(modelsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => require(path.join(modelsDir, file)));

const prune = process.argv.includes("--prune");

const setup = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false });
  console.log(`Connected to database "${mongoose.connection.name}"`);

  for (const model of models) {
    await model.createCollection().catch(() => {});
    if (prune) {
      const dropped = await model.syncIndexes();
      console.log(`${model.modelName}: indexes synced${dropped.length ? ` (dropped ${dropped.join(", ")})` : ""}`);
    } else {
      await model.createIndexes();
      console.log(`${model.modelName}: indexes ready`);
    }
  }

  await mongoose.disconnect();
};

setup().catch((err) => {
  console.error("Database setup failed:", err.message);
  process.exit(1);
});

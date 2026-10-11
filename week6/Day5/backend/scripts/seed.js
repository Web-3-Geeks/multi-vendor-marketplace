const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const Vendor = require("../models/Vendor");
const VENDOR_STATUS = require("../constants/vendorStatus");

dotenv.config();

const users = [
  {
    name: "Vendor Demo",
    email: "vendor@test.com",
    password: process.env.SEED_VENDOR_PASSWORD,
    role: ROLES.VENDOR,
  },
  {
    name: "Admin Demo",
    email: "admin@test.com",
    password: process.env.SEED_ADMIN_PASSWORD,
    role: ROLES.ADMIN,
  },
];

const seed = async () => {
  const missing = users.filter((u) => !u.password);
  if (missing.length) {
    throw new Error(
      `Missing seed password for: ${missing.map((u) => u.email).join(", ")}`,
    );
  }

  await mongoose.connect(process.env.DATABASE_URL);

  for (const data of users) {
    const exists = await User.findOne({ email: data.email });
    if (exists) {
      console.log(`Skipped ${data.email} (already exists)`);
      continue;
    }
    await User.create(data);
    console.log(`Created ${data.role}: ${data.email}`);
  }

  const vendorUser = await User.findOne({ email: "vendor@test.com" });
  const hasStore = await Vendor.exists({ user: vendorUser._id });
  if (hasStore) {
    console.log("Skipped store for vendor@test.com (already exists)");
  } else {
    await Vendor.create({
      user: vendorUser._id,
      storeName: "Demo Store",
      storeDescription: "The demo vendor's store",
      status: VENDOR_STATUS.APPROVED,
    });
    console.log("Created APPROVED store for vendor@test.com");
  }

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

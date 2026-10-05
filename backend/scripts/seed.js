const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const ROLES = require("../constants/roles");

dotenv.config();

const users = [
  { name: "Vendor Demo", email: "vendor@test.com", password: "pass1234", role: ROLES.VENDOR },
  { name: "Admin Demo", email: "admin@test.com", password: "pass1234", role: ROLES.ADMIN },
];

const seed = async () => {
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

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

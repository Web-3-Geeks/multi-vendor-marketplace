const crypto = require("crypto");
const slugify = require("./slugify");

function uniqueSlug(text) {
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slugify(text)}-${suffix}`;
}

module.exports = uniqueSlug;

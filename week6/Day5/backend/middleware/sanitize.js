// Defence in depth against NoSQL operator injection: every endpoint also validates
// its input types, but anything that slips through can't carry a "$where" or a
// "a.b" key into a query. Express 5 makes req.query read-only, so only the JSON
// body is cleaned here (query values are validated and only ever used as strings).
const isPlainObject = (value) => value !== null && typeof value === "object" && !Buffer.isBuffer(value);

const clean = (value) => {
  if (Array.isArray(value)) return value.forEach(clean);
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
    } else {
      clean(value[key]);
    }
  }
};

const sanitizeBody = (req, res, next) => {
  clean(req.body);
  next();
};

module.exports = sanitizeBody;

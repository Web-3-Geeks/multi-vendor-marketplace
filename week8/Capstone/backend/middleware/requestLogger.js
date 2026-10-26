// One line per request: method, path, status, duration and the user id (when logged
// in). The query string and body are never logged, so passwords, tokens and
// payment details can't end up in the logs. Set REQUEST_LOG=off to silence it.
const requestLogger = (req, res, next) => {
  if (process.env.REQUEST_LOG === "off") return next();

  const start = process.hrtime.bigint();
  // Read now: once a router handles the request, req.path loses its mount prefix
  // (/api/cart/items becomes /items).
  const path = req.path;
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms user=${req.user?._id || "-"}`);
  });
  next();
};

module.exports = requestLogger;

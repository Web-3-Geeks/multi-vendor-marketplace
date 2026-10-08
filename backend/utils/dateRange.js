const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// "to" given as a plain date (2026-10-08) means "through the end of that day".
const buildDateRange = (from, to) => {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(DATE_ONLY.test(to) ? `${to}T23:59:59.999Z` : to);
  return range;
};

module.exports = buildDateRange;

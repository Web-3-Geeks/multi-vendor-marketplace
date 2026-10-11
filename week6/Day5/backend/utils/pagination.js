const DEFAULT_LIMIT = 20;

// page/limit come from validated query values (see validators/queryRules.js).
const pageParams = (query, defaultLimit = DEFAULT_LIMIT) => {
  const page = query.page || 1;
  const limit = query.limit || defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
};

const pageInfo = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { pageParams, pageInfo };

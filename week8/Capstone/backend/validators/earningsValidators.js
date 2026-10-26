const { COMMISSION_STATUS } = require("../constants/commissionStatus");
const { optionalQuery, paginationRules, dateRangeRules } = require("./queryRules");

const listEarningsRules = [
  optionalQuery("status")
    .isIn(Object.values(COMMISSION_STATUS))
    .withMessage(`Status must be one of: ${Object.values(COMMISSION_STATUS).join(", ")}`),
  ...dateRangeRules,
  ...paginationRules,
];

module.exports = { listEarningsRules };

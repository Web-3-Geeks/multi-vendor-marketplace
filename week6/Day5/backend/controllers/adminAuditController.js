const { matchedData } = require("express-validator");
const AuditLog = require("../models/AuditLog");
const { toAuditDTO } = require("../services/auditService");
const buildDateRange = require("../utils/dateRange");

const DEFAULT_LIMIT = 20;

const listAuditLogs = async (req, res) => {
  const q = matchedData(req, { locations: ["query"] });
  const page = q.page || 1;
  const limit = q.limit || DEFAULT_LIMIT;

  const filter = {};
  if (q.entityType) filter.entityType = q.entityType;
  if (q.entityId) filter.entityId = q.entityId;
  if (q.orderId) filter.order = q.orderId;
  if (q.action) filter.action = q.action;
  if (q.actor) filter.actor = q.actor;
  if (q.source) filter.source = q.source;
  const createdAt = buildDateRange(q.from, q.to);
  if (createdAt) filter.createdAt = createdAt;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    logs: logs.map(toAuditDTO),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

module.exports = { listAuditLogs };

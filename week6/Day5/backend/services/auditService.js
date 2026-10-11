const AuditLog = require("../models/AuditLog");
const { AUDIT_SOURCE } = require("../constants/audit");

// `actor` is the logged-in user (anything with _id and role) or null for webhooks
// and system work. Pass the transaction `session` when the change being recorded is
// part of one, so the entry is committed or rolled back together with it.
const record = async ({ actor = null, source, action, entityType, entityId, order, metadata = {} }, session) => {
  const [entry] = await AuditLog.create(
    [
      {
        actor: actor?._id || null,
        actorRole: actor?.role || "SYSTEM",
        source: source || (actor ? AUDIT_SOURCE.API : AUDIT_SOURCE.SYSTEM),
        action,
        entityType,
        entityId,
        order,
        metadata,
      },
    ],
    session ? { session } : {},
  );
  return entry;
};

const toAuditDTO = (entry) => ({
  id: entry._id,
  action: entry.action,
  entityType: entry.entityType,
  entityId: entry.entityId,
  orderId: entry.order || null,
  source: entry.source,
  actor: entry.actor && entry.actor.name
    ? { id: entry.actor._id, name: entry.actor.name, email: entry.actor.email, role: entry.actorRole }
    : entry.actor
      ? { id: entry.actor, role: entry.actorRole }
      : null,
  actorRole: entry.actorRole,
  metadata: entry.metadata,
  createdAt: entry.createdAt,
});

module.exports = { record, toAuditDTO };

const mongoose = require("mongoose");
const { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_SOURCE } = require("../constants/audit");

const auditLogSchema = new mongoose.Schema(
  {
    // null when the change was made by a webhook or by the system itself.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "SYSTEM" },
    source: { type: String, enum: Object.values(AUDIT_SOURCE), default: AUDIT_SOURCE.API },
    action: { type: String, enum: Object.values(AUDIT_ACTION), required: true },
    entityType: { type: String, enum: Object.values(AUDIT_ENTITY), required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Set for anything that belongs to an order, so one query gives an order's whole timeline.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ order: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// The trail is append-only: nothing in the application edits or removes an entry.
const immutable = function () {
  throw new Error("Audit log entries cannot be modified or deleted");
};
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  auditLogSchema.pre(hook, immutable);
}

module.exports = mongoose.model("AuditLog", auditLogSchema);

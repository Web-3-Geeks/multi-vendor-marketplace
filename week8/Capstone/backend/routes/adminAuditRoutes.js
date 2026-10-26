const express = require("express");
const { listAuditLogs } = require("../controllers/adminAuditController");
const { listAuditLogsRules } = require("../validators/adminValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get("/", listAuditLogsRules, validate, listAuditLogs);

module.exports = router;

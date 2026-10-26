const express = require("express");
const { getStats } = require("../controllers/adminStatsController");
const { authenticate, requireRole } = require("../middleware/auth");
const ROLES = require("../constants/roles");

const router = express.Router();

router.get("/", authenticate, requireRole(ROLES.ADMIN), getStats);

module.exports = router;

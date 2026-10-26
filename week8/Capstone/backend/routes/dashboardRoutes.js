const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const ROLES = require("../constants/roles");

const router = express.Router();

const dashboardResponse = (req, res) => {
  res.json({
    message: `Welcome to the ${req.user.role.toLowerCase()} dashboard`,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

router.get("/customer/dashboard", authenticate, requireRole(ROLES.CUSTOMER), dashboardResponse);
router.get("/vendor/dashboard", authenticate, requireRole(ROLES.VENDOR), dashboardResponse);
router.get("/admin/dashboard", authenticate, requireRole(ROLES.ADMIN), dashboardResponse);

module.exports = router;

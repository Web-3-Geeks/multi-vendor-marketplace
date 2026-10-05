const express = require("express");
const { register, login, me, logout } = require("../controllers/authController");
const { registerRules, loginRules } = require("../validators/authValidators");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);
router.get("/me", authenticate, me);
router.post("/logout", logout);

module.exports = router;

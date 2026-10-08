const express = require("express");
const { listPayments, getPayment, refund } = require("../controllers/adminPaymentController");
const {
  listPaymentsRules,
  paymentIdRules,
  refundPaymentRules,
} = require("../validators/adminValidators");
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get("/", listPaymentsRules, validate, listPayments);
router.get("/:id", paymentIdRules, validate, getPayment);
router.post("/:id/refund", refundPaymentRules, validate, refund);

module.exports = router;

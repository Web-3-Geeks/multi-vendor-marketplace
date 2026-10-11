const { ORDER_STATUS } = require("../constants/orderStatus");
const { PAYMENT_STATUS } = require("../constants/paymentStatus");

// The single source of truth for which status may follow which. Every place that
// changes a status either asserts a transition here or builds its database
// filter from fromStates(), so the rules can't drift apart.
const freeze = (map) => Object.freeze(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Object.freeze(v)])));

// Order and order-item fulfilment. Payment moves PENDING -> CONFIRMED; after that
// one step at a time. CANCELLED is reachable from any state that isn't final.
const ORDER_TRANSITIONS = freeze({
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});

// One payment attempt. FAILED, CANCELLED and REFUNDED are final: a retry is a new payment.
const PAYMENT_TRANSITIONS = freeze({
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.FAILED]: [],
  [PAYMENT_STATUS.REFUNDED]: [],
  [PAYMENT_STATUS.CANCELLED]: [],
});

// Order.paymentStatus summarises all attempts, so it is looser than one payment:
// a FAILED order can still be paid by a retry, and a payment that arrives late for a
// cancelled order is recorded as PAID (an admin then refunds it) rather than lost.
const ORDER_PAYMENT_TRANSITIONS = freeze({
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.FAILED]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.CANCELLED]: [PAYMENT_STATUS.PAID],
  [PAYMENT_STATUS.REFUNDED]: [],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
});

const canTransition = (machine, from, to) => Boolean(machine[from]?.includes(to));

// Every status that is allowed to move to `to`: used as the filter of an atomic
// findOneAndUpdate so the database itself refuses an invalid change.
const fromStates = (machine, to) =>
  Object.entries(machine)
    .filter(([, targets]) => targets.includes(to))
    .map(([from]) => from);

const isFinal = (machine, status) => (machine[status] || []).length === 0;

module.exports = {
  ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  ORDER_PAYMENT_TRANSITIONS,
  canTransition,
  fromStates,
  isFinal,
};

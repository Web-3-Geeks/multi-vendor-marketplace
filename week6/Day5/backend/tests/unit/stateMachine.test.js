const sm = require("../../services/stateMachine");

const ORDER = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT = ["PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED", "CANCELLED"];

const expectedOrder = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const expectedPayment = {
  PENDING: ["PROCESSING", "PAID", "FAILED", "CANCELLED"],
  PROCESSING: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
  CANCELLED: [],
};

describe("order status transitions", () => {
  test.each(ORDER.flatMap((from) => ORDER.map((to) => [from, to])))("%s -> %s", (from, to) => {
    expect(sm.canTransition(sm.ORDER_TRANSITIONS, from, to)).toBe(expectedOrder[from].includes(to));
  });

  test("DELIVERED and CANCELLED are final, the others are not", () => {
    expect(sm.isFinal(sm.ORDER_TRANSITIONS, "DELIVERED")).toBe(true);
    expect(sm.isFinal(sm.ORDER_TRANSITIONS, "CANCELLED")).toBe(true);
    expect(sm.isFinal(sm.ORDER_TRANSITIONS, "PENDING")).toBe(false);
  });

  test("no status can skip a step, go backwards or repeat itself", () => {
    expect(sm.canTransition(sm.ORDER_TRANSITIONS, "PENDING", "SHIPPED")).toBe(false);
    expect(sm.canTransition(sm.ORDER_TRANSITIONS, "SHIPPED", "PROCESSING")).toBe(false);
    for (const status of ORDER) expect(sm.canTransition(sm.ORDER_TRANSITIONS, status, status)).toBe(false);
  });
});

describe("payment status transitions", () => {
  test.each(PAYMENT.flatMap((from) => PAYMENT.map((to) => [from, to])))("%s -> %s", (from, to) => {
    expect(sm.canTransition(sm.PAYMENT_TRANSITIONS, from, to)).toBe(expectedPayment[from].includes(to));
  });

  test("a failed, cancelled or refunded payment is final: a retry is a new payment", () => {
    for (const status of ["FAILED", "CANCELLED", "REFUNDED"]) expect(sm.isFinal(sm.PAYMENT_TRANSITIONS, status)).toBe(true);
  });

  test("a paid payment can only be refunded", () => {
    expect(sm.PAYMENT_TRANSITIONS.PAID).toEqual(["REFUNDED"]);
  });
});

describe("order paymentStatus transitions", () => {
  test("a retry can still pay a FAILED order", () => {
    expect(sm.canTransition(sm.ORDER_PAYMENT_TRANSITIONS, "FAILED", "PAID")).toBe(true);
  });

  test("a late payment on a cancelled order is recorded as PAID, never lost", () => {
    expect(sm.canTransition(sm.ORDER_PAYMENT_TRANSITIONS, "CANCELLED", "PAID")).toBe(true);
  });

  test("a refunded order can't be paid again", () => {
    expect(sm.canTransition(sm.ORDER_PAYMENT_TRANSITIONS, "REFUNDED", "PAID")).toBe(false);
  });
});

describe("helpers", () => {
  test("fromStates lists every status allowed to move to the target", () => {
    expect(sm.fromStates(sm.PAYMENT_TRANSITIONS, "PAID").sort()).toEqual(["PENDING", "PROCESSING"]);
    expect(sm.fromStates(sm.PAYMENT_TRANSITIONS, "REFUNDED")).toEqual(["PAID"]);
    expect(sm.fromStates(sm.ORDER_TRANSITIONS, "CONFIRMED")).toEqual(["PENDING"]);
    expect(sm.fromStates(sm.ORDER_TRANSITIONS, "PENDING")).toEqual([]);
  });

  test("unknown statuses never transition", () => {
    expect(sm.canTransition(sm.ORDER_TRANSITIONS, "BOGUS", "PENDING")).toBe(false);
    expect(sm.canTransition(sm.ORDER_TRANSITIONS, "PENDING", "BOGUS")).toBe(false);
    expect(sm.canTransition(sm.PAYMENT_TRANSITIONS, undefined, "PAID")).toBe(false);
  });

  test("the transition tables are frozen so nothing can change them at runtime", () => {
    expect(Object.isFrozen(sm.ORDER_TRANSITIONS)).toBe(true);
    expect(Object.isFrozen(sm.PAYMENT_TRANSITIONS.PENDING)).toBe(true);
  });
});

const { round2 } = require("../../utils/money");
const escapeRegex = require("../../utils/escapeRegex");
const buildDateRange = require("../../utils/dateRange");
const { pageParams, pageInfo } = require("../../utils/pagination");
const { publishErrors } = require("../../utils/productRules");
const slugify = require("../../utils/slugify");
const sanitizeBody = require("../../middleware/sanitize");
const { getCommissionRate } = require("../../services/commissionService");

describe("round2", () => {
  test("rounds money to two decimals", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.999)).toBe(20);
    expect(round2(1.005 * 100)).toBe(100.5);
    expect(round2(0)).toBe(0);
  });
});

describe("escapeRegex", () => {
  test("neutralises every regex metacharacter", () => {
    expect(new RegExp(escapeRegex(".*+?^${}()|[]\\")).test(".*+?^${}()|[]\\")).toBe(true);
    expect(new RegExp(escapeRegex(".*")).test("abc")).toBe(false);
    expect(new RegExp(escapeRegex("(a+)+$")).test("aaaa")).toBe(false);
  });
});

describe("buildDateRange", () => {
  test("returns undefined when there is no range", () => {
    expect(buildDateRange(undefined, undefined)).toBeUndefined();
  });

  test("a plain 'to' date includes the whole day", () => {
    const range = buildDateRange("2026-10-01", "2026-10-08");
    expect(range.$gte).toEqual(new Date("2026-10-01"));
    expect(range.$lte).toEqual(new Date("2026-10-08T23:59:59.999Z"));
  });

  test("works with only one end and with full timestamps", () => {
    expect(buildDateRange("2026-10-01")).toEqual({ $gte: new Date("2026-10-01") });
    expect(buildDateRange(undefined, "2026-10-08T10:00:00Z")).toEqual({ $lte: new Date("2026-10-08T10:00:00Z") });
  });
});

describe("pagination helpers", () => {
  test("pageParams applies defaults and computes skip", () => {
    expect(pageParams({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(pageParams({ page: 3, limit: 5 })).toEqual({ page: 3, limit: 5, skip: 10 });
    expect(pageParams({}, 10).limit).toBe(10);
  });

  test("pageInfo always reports at least one page", () => {
    expect(pageInfo(1, 10, 0)).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
    expect(pageInfo(1, 10, 25).totalPages).toBe(3);
    expect(pageInfo(2, 10, 20).totalPages).toBe(2);
  });
});

describe("publishErrors", () => {
  test("a product needs a real description to be published", () => {
    expect(publishErrors({ description: "Nice" })).toEqual([]);
    expect(publishErrors({ description: "   " })).toHaveLength(1);
    expect(publishErrors({})).toHaveLength(1);
  });
});

describe("slugify", () => {
  test("makes URL-friendly slugs", () => {
    expect(slugify("Wireless Mouse (Black)!")).toBe("wireless-mouse-black");
  });
});

describe("sanitizeBody", () => {
  const run = (body) => {
    const req = { body };
    const next = jest.fn();
    sanitizeBody(req, {}, next);
    return { req, next };
  };

  test("strips $-prefixed and dotted keys at every depth, keeps everything else", () => {
    const { req, next } = run({ a: 1, $where: "x", "b.c": 2, nested: { $gt: 1, ok: true, deep: [{ $ne: 1, keep: 1 }] } });
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ a: 1, nested: { ok: true, deep: [{ keep: 1 }] } });
  });

  test("leaves a raw Buffer body (the webhook) untouched and tolerates a missing body", () => {
    const buffer = Buffer.from("raw bytes");
    expect(run(buffer).req.body).toBe(buffer);
    expect(() => run(undefined)).not.toThrow();
  });
});

describe("getCommissionRate", () => {
  const original = process.env.COMMISSION_RATE;
  afterEach(() => {
    process.env.COMMISSION_RATE = original;
  });

  test("reads the configured rate, including 0 and 1", () => {
    process.env.COMMISSION_RATE = "0.15";
    expect(getCommissionRate()).toBe(0.15);
    process.env.COMMISSION_RATE = "0";
    expect(getCommissionRate()).toBe(0);
    process.env.COMMISSION_RATE = "1";
    expect(getCommissionRate()).toBe(1);
  });

  test("falls back to 10% when blank", () => {
    process.env.COMMISSION_RATE = "";
    expect(getCommissionRate()).toBe(0.1);
  });

  test("rejects a rate outside 0-1 or a non-number", () => {
    for (const bad of ["1.5", "-0.1", "abc"]) {
      process.env.COMMISSION_RATE = bad;
      expect(() => getCommissionRate()).toThrow(/between 0 and 1/);
    }
  });
});

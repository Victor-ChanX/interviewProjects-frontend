import { describe, expect, it } from "vitest";

import {
  businessDate,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format-date";

describe("formatDateTime", () => {
  it("renders ISO instants in the business time zone", () => {
    expect(formatDateTime("2026-08-31T16:30:00Z")).toBe("2026-09-01 00:30");
  });

  it("falls back to a dash for empty or invalid input", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
  });
});

describe("businessDate", () => {
  it("rolls over to the next day at 16:00 UTC (time zone discriminator)", () => {
    expect(businessDate(new Date("2026-08-31T16:30:00Z"))).toBe("2026-09-01");
    expect(businessDate(new Date("2026-08-31T15:30:00Z"))).toBe("2026-08-31");
  });
});

describe("formatRelativeTime", () => {
  // 2026-09-30 08:00 UTC 是周三，作为固定的「现在」。
  const now = Date.parse("2026-09-30T08:00:00Z");

  it("picks the largest unit that fits", () => {
    expect(formatRelativeTime("2026-09-30T08:03:30Z", now)).toBe("4分钟后");
    expect(formatRelativeTime("2026-09-30T10:00:00Z", now)).toBe("2小时后");
    expect(formatRelativeTime("2026-10-03T08:00:00Z", now)).toBe("3天后");
  });

  it("uses past tense for expired instants", () => {
    expect(formatRelativeTime("2026-09-30T07:30:00Z", now)).toBe("30分钟前");
  });

  it("rounds sub-minute deltas to one minute", () => {
    expect(formatRelativeTime("2026-09-30T08:00:20Z", now)).toBe("1分钟后");
    expect(formatRelativeTime("2026-09-30T07:59:50Z", now)).toBe("1分钟前");
  });

  it("falls back to a dash for empty or invalid input", () => {
    expect(formatRelativeTime(null, now)).toBe("-");
    expect(formatRelativeTime("nope", now)).toBe("-");
  });
});

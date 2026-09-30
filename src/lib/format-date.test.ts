import { describe, expect, it } from "vitest";

import {
  formatDateTime,
  formatRelativeTime,
  localDate,
  viewerTimeZone,
} from "@/lib/format-date";

describe("formatDateTime", () => {
  it("renders the same instant in the viewer's time zone", () => {
    expect(formatDateTime("2026-08-31T16:30:00Z", "Asia/Shanghai")).toBe(
      "2026-09-01 00:30",
    );
    expect(formatDateTime("2026-08-31T16:30:00Z", "UTC")).toBe(
      "2026-08-31 16:30",
    );
    expect(formatDateTime("2026-08-31T16:30:00Z", "America/New_York")).toBe(
      "2026-08-31 12:30",
    );
  });

  it("defaults to the browser time zone", () => {
    const instant = "2026-08-31T16:30:00Z";

    expect(formatDateTime(instant)).toBe(
      formatDateTime(instant, viewerTimeZone()),
    );
  });

  it("falls back to a dash for empty or invalid input", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("-");
  });
});

describe("localDate", () => {
  it("rolls over at the viewer's midnight (time zone discriminator)", () => {
    const lateUtc = new Date("2026-08-31T16:30:00Z");

    expect(localDate(lateUtc, "Asia/Shanghai")).toBe("2026-09-01");
    expect(localDate(lateUtc, "UTC")).toBe("2026-08-31");
    expect(
      localDate(new Date("2026-08-31T03:30:00Z"), "America/New_York"),
    ).toBe("2026-08-30");
  });
});

describe("viewerTimeZone", () => {
  it("returns the runtime's IANA zone name", () => {
    expect(viewerTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
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

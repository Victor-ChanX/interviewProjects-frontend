import { describe, expect, it } from "vitest";

import { businessDate, formatDateTime } from "@/lib/format-date";

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

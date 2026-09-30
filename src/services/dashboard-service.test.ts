import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  buildDashboardSummaryUrl,
  getDashboardSummary,
} from "@/services/dashboard-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildDashboardSummaryUrl", () => {
  it("passes the viewer time zone as an encoded timeZone query", () => {
    expect(buildDashboardSummaryUrl("America/New_York")).toBe(
      "/api/dashboard/summary?timeZone=America%2FNew_York",
    );
    expect(buildDashboardSummaryUrl("UTC")).toBe(
      "/api/dashboard/summary?timeZone=UTC",
    );
  });
});

describe("getDashboardSummary", () => {
  it("GETs the summary for that time zone and returns the body as-is", async () => {
    const body = { accounts: { total: 5 }, timeZone: "Asia/Shanghai" };

    api.get.mockResolvedValue(body);

    await expect(getDashboardSummary("Asia/Shanghai")).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith(
      "/api/dashboard/summary?timeZone=Asia%2FShanghai",
    );
  });
});

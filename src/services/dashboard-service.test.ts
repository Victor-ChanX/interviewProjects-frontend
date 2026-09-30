import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import { getDashboardSummary } from "@/services/dashboard-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardSummary", () => {
  it("GETs /api/dashboard/summary and returns the body as-is", async () => {
    const body = { accounts: { total: 5 }, timeZone: "Asia/Shanghai" };

    api.get.mockResolvedValue(body);

    await expect(getDashboardSummary()).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith("/api/dashboard/summary");
  });
});

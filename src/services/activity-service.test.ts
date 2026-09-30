import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import { listActivity } from "@/services/activity-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listActivity", () => {
  it("passes before + limit as query and returns the page as-is", async () => {
    const page = { items: [], nextCursor: "c2VxOjcx" };

    api.get.mockResolvedValue(page);

    await expect(listActivity({ before: "cur", limit: 20 })).resolves.toEqual(
      page,
    );
    expect(api.get).toHaveBeenCalledWith("/api/activity", {
      query: { before: "cur", limit: 20 },
    });
  });

  it("leaves before undefined for the first page", async () => {
    api.get.mockResolvedValue({ items: [], nextCursor: null });

    await listActivity({ limit: 50 });

    expect(api.get).toHaveBeenCalledWith("/api/activity", {
      query: { before: undefined, limit: 50 },
    });
  });
});

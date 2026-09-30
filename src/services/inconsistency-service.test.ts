import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  getInconsistency,
  inconsistencyUrl,
  listInconsistencies,
  resolvedParam,
  resolveInconsistency,
} from "@/services/inconsistency-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("url builders", () => {
  it("encodes the id", () => {
    expect(inconsistencyUrl("a/b c")).toBe("/api/inconsistencies/a%2Fb%20c");
  });

  it("maps tabs to the resolved query value", () => {
    expect(resolvedParam("open")).toBe("false");
    expect(resolvedParam("resolved")).toBe("true");
  });
});

describe("listInconsistencies", () => {
  it("sends resolved + before + limit", async () => {
    const page = { items: [], nextCursor: null };

    api.get.mockResolvedValue(page);

    await expect(
      listInconsistencies({ tab: "open", before: "cur", limit: 50 }),
    ).resolves.toEqual(page);
    expect(api.get).toHaveBeenCalledWith("/api/inconsistencies", {
      query: { resolved: "false", before: "cur", limit: 50 },
    });
  });
});

describe("getInconsistency / resolveInconsistency", () => {
  it("GETs the detail and POSTs resolve on the same path", async () => {
    api.get.mockResolvedValue({ id: "i1", payload: {} });
    api.post.mockResolvedValue({ id: "i1", resolvedBy: "admin" });

    await expect(getInconsistency("i1")).resolves.toEqual({
      id: "i1",
      payload: {},
    });
    await expect(resolveInconsistency("i1")).resolves.toEqual({
      id: "i1",
      resolvedBy: "admin",
    });
    expect(api.get).toHaveBeenCalledWith("/api/inconsistencies/i1");
    expect(api.post).toHaveBeenCalledWith("/api/inconsistencies/i1/resolve");
  });
});

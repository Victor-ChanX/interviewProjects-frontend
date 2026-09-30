import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  getGroup,
  groupUrl,
  listGroups,
  patchGroup,
} from "@/services/group-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("groupUrl", () => {
  it("encodes the id into the path", () => {
    expect(groupUrl("g/1 a")).toBe("/api/groups/g%2F1%20a");
  });
});

describe("listGroups", () => {
  it("GETs the bare array without query string", async () => {
    api.get.mockResolvedValue([{ id: "g1" }]);

    await expect(listGroups()).resolves.toEqual([{ id: "g1" }]);
    expect(api.get).toHaveBeenCalledWith("/api/groups");
  });
});

describe("getGroup", () => {
  it("GETs /api/groups/:id", async () => {
    api.get.mockResolvedValue({ id: "g1" });

    await expect(getGroup("g1")).resolves.toEqual({ id: "g1" });
    expect(api.get).toHaveBeenCalledWith("/api/groups/g1");
  });
});

describe("patchGroup", () => {
  it("PATCHes only the flags given", async () => {
    api.patch.mockResolvedValue({ id: "g1", agentEnabled: false });

    await expect(patchGroup("g1", { agentEnabled: false })).resolves.toEqual({
      id: "g1",
      agentEnabled: false,
    });
    expect(api.patch).toHaveBeenCalledWith("/api/groups/g1", {
      agentEnabled: false,
    });
  });
});

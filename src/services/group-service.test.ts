import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api }));

import {
  createGroup,
  deleteGroup,
  getGroup,
  groupUrl,
  leaveAllGroup,
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

describe("createGroup", () => {
  it("POSTs the creator and ordered members to /api/groups and returns the job id", async () => {
    api.post.mockResolvedValue({ jobId: "j1" });

    await expect(
      createGroup({ creatorAccountId: "a0", memberAccountIds: ["a2", "a1"] }),
    ).resolves.toEqual({ jobId: "j1" });
    expect(api.post).toHaveBeenCalledWith("/api/groups", {
      creatorAccountId: "a0",
      memberAccountIds: ["a2", "a1"],
    });
  });

  it("propagates the request error (422 ACCOUNT_NOT_ONLINE etc.)", async () => {
    const failure = new Error("账号不在线");

    api.post.mockRejectedValue(failure);

    await expect(
      createGroup({ creatorAccountId: "a0", memberAccountIds: ["a1"] }),
    ).rejects.toBe(failure);
  });
});

describe("leaveAllGroup", () => {
  it("POSTs to /api/groups/:id/leave-all without a body, encoding the id", async () => {
    api.post.mockResolvedValue({ jobId: "j2" });

    await expect(leaveAllGroup("g/1")).resolves.toEqual({ jobId: "j2" });
    expect(api.post).toHaveBeenCalledWith("/api/groups/g%2F1/leave-all");
  });
});

describe("deleteGroup", () => {
  it("DELETEs the group path and returns the counts", async () => {
    const body = {
      id: "g1",
      messagesDeleted: 3,
      agentRunsDeleted: 1,
      sequenceRunsDeleted: 0,
    };

    api.delete.mockResolvedValue(body);

    await expect(deleteGroup("g/1")).resolves.toEqual(body);
    expect(api.delete).toHaveBeenCalledWith("/api/groups/g%2F1");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  agentRunUrl,
  getAgentRun,
  groupAgentRunsUrl,
  listAgentRuns,
  listGroupAgentRuns,
} from "@/services/agent-run-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("url builders", () => {
  it("encode ids into both paths", () => {
    expect(groupAgentRunsUrl("g 1")).toBe("/api/groups/g%201/agent-runs");
    expect(agentRunUrl("r/1")).toBe("/api/agent-runs/r%2F1");
  });
});

describe("listGroupAgentRuns", () => {
  it("GETs the group's runs and returns { items, total } as-is", async () => {
    const body = { items: [{ id: "r1" }], total: 1 };

    api.get.mockResolvedValue(body);

    await expect(listGroupAgentRuns("g1")).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith("/api/groups/g1/agent-runs");
  });
});

describe("getAgentRun", () => {
  it("GETs /api/agent-runs/:id", async () => {
    api.get.mockResolvedValue({ id: "r1", steps: [] });

    await expect(getAgentRun("r1")).resolves.toEqual({ id: "r1", steps: [] });
    expect(api.get).toHaveBeenCalledWith("/api/agent-runs/r1");
  });
});

describe("listAgentRuns", () => {
  it("GETs the global list with every filter as query", async () => {
    const page = { items: [], nextCursor: null };

    api.get.mockResolvedValue(page);

    await expect(
      listAgentRuns({
        status: "blocked",
        groupId: "g1",
        before: "c",
        limit: 50,
      }),
    ).resolves.toEqual(page);
    expect(api.get).toHaveBeenCalledWith("/api/agent-runs", {
      query: { status: "blocked", groupId: "g1", before: "c", limit: 50 },
    });
  });

  it("leaves unset filters undefined (the request layer drops them)", async () => {
    api.get.mockResolvedValue({ items: [], nextCursor: null });

    await listAgentRuns({ limit: 20 });

    expect(api.get).toHaveBeenCalledWith("/api/agent-runs", {
      query: {
        status: undefined,
        groupId: undefined,
        before: undefined,
        limit: 20,
      },
    });
  });
});

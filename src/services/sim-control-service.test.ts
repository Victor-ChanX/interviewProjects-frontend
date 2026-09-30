import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  getSimControls,
  simulateInbound,
  simulateInboundUrl,
} from "@/services/sim-control-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("simulateInboundUrl", () => {
  it("encodes the group id under the groups prefix", () => {
    expect(simulateInboundUrl("g/1")).toBe(
      "/api/groups/g%2F1/simulate-inbound",
    );
  });
});

describe("getSimControls", () => {
  it("GETs /api/sim-controls and returns the body as-is", async () => {
    api.get.mockResolvedValue({ enabled: true });

    await expect(getSimControls()).resolves.toEqual({ enabled: true });
    expect(api.get).toHaveBeenCalledWith("/api/sim-controls");
  });
});

describe("simulateInbound", () => {
  it("POSTs the sender and text to the group's simulate-inbound path", async () => {
    api.post.mockResolvedValue({ gatewayGroupId: "g_abc" });

    await expect(
      simulateInbound("g1", { senderPlatformUserId: "ext-alice", text: "hi" }),
    ).resolves.toEqual({ gatewayGroupId: "g_abc" });
    expect(api.post).toHaveBeenCalledWith("/api/groups/g1/simulate-inbound", {
      senderPlatformUserId: "ext-alice",
      text: "hi",
    });
  });
});

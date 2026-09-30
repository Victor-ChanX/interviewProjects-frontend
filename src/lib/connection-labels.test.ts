import { describe, expect, it } from "vitest";

import { connectionBadge } from "@/lib/connection-labels";

describe("connectionBadge", () => {
  it("hides the badge before the connection starts", () => {
    expect(connectionBadge("idle")).toBeNull();
  });

  it("uses the manual's wording for the reconnect sequence", () => {
    expect(connectionBadge("reconnecting")).toEqual({
      label: "重连中",
      tone: "warning",
      pending: true,
    });
    expect(connectionBadge("syncing")).toEqual({
      label: "同步中",
      tone: "info",
      pending: true,
    });
    expect(connectionBadge("open")).toEqual({
      label: "实时",
      tone: "success",
      pending: false,
    });
    expect(connectionBadge("closed")?.label).toBe("离线");
    expect(connectionBadge("connecting")?.label).toBe("连接中");
  });
});

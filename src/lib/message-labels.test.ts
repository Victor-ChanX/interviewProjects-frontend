import { describe, expect, it } from "vitest";

import {
  buildSenderNames,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
  senderDisplay,
  shouldShowFailCode,
} from "@/lib/message-labels";

describe("delivery labels", () => {
  it("labels all six delivery states", () => {
    expect(DELIVERY_STATUS_LABELS).toEqual({
      queued: "排队中",
      accepted: "已受理",
      sent: "已发送",
      failed: "发送失败",
      unknown: "状态未知",
      cancelled: "已取消",
    });
    expect(DELIVERY_STATUS_TONE.failed).toBe("danger");
    expect(DELIVERY_STATUS_TONE.unknown).toBe("warning");
    expect(DELIVERY_STATUS_TONE.sent).toBe("success");
  });
});

describe("shouldShowFailCode", () => {
  it("shows the code for failed and cancelled messages only", () => {
    expect(shouldShowFailCode("failed", "NETWORK_TIMEOUT")).toBe(true);
    expect(shouldShowFailCode("cancelled", "ACCOUNT_TERMINAL")).toBe(true);
    expect(shouldShowFailCode("sent", "X")).toBe(false);
    expect(shouldShowFailCode("failed", null)).toBe(false);
    expect(shouldShowFailCode(null, "X")).toBe(false);
  });
});

describe("senderDisplay", () => {
  const names = buildSenderNames([
    { id: "acc-1", platformUserId: "pu_cf9df9b99fc0" },
    { id: "acc-12", platformUserId: "pu_0000000000aa" },
    { id: "acc-3", platformUserId: null },
  ]);

  it("shows our own accounts by account id", () => {
    expect(senderDisplay("pu_cf9df9b99fc0", names)).toEqual({
      name: "acc-1",
      initials: "A1",
    });
    expect(senderDisplay("pu_0000000000aa", names)).toEqual({
      name: "acc-12",
      initials: "A12",
    });
  });

  it("keeps the platform user id for external members", () => {
    expect(senderDisplay("ext-alice", names)).toEqual({
      name: "ext-alice",
      initials: "AL",
    });
    expect(senderDisplay("pu_ffffffffffff", new Map())).toEqual({
      name: "pu_ffffffffffff",
      initials: "FF",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
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

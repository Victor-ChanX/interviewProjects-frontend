import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
} from "@/lib/account-labels";
import { ACCOUNT_STATUSES } from "@/lib/account-transitions";

describe("account labels", () => {
  it("labels every status with the manual-testing wording", () => {
    expect(ACCOUNT_STATUS_LABELS).toEqual({
      idle: "空闲",
      online: "在线",
      rate_limited: "限流中",
      disconnected: "已离线",
      suspended: "已停用",
      session_expired: "会话失效",
    });
  });

  it("gives every status a tone; terminal states are danger", () => {
    for (const status of ACCOUNT_STATUSES)
      expect(ACCOUNT_STATUS_TONE[status]).toBeTruthy();

    expect(ACCOUNT_STATUS_TONE.online).toBe("success");
    expect(ACCOUNT_STATUS_TONE.rate_limited).toBe("warning");
    expect(ACCOUNT_STATUS_TONE.suspended).toBe("danger");
    expect(ACCOUNT_STATUS_TONE.session_expired).toBe("danger");
  });
});

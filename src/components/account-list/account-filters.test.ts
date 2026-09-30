import { describe, expect, it } from "vitest";

import type { AccountStatus } from "@/lib/account-transitions";

import {
  ACCOUNT_TAB_LABELS,
  ACCOUNT_TABS,
  countAccountTabs,
  matchesAccountTab,
} from "./account-filters";

describe("account tabs", () => {
  it("are 全部 / 在线 / 限流 / 离线 / 已停用 in that order", () => {
    expect(ACCOUNT_TABS.map((tab) => ACCOUNT_TAB_LABELS[tab])).toEqual([
      "全部",
      "在线",
      "限流",
      "离线",
      "已停用",
    ]);
  });

  it("groups idle + disconnected as offline and both terminal states as disabled", () => {
    expect(matchesAccountTab("idle", "offline")).toBe(true);
    expect(matchesAccountTab("disconnected", "offline")).toBe(true);
    expect(matchesAccountTab("online", "offline")).toBe(false);
    expect(matchesAccountTab("session_expired", "disabled")).toBe(true);
    expect(matchesAccountTab("rate_limited", "rate_limited")).toBe(true);
    expect(matchesAccountTab("suspended", "all")).toBe(true);
  });

  it("counts every tab", () => {
    const statuses: AccountStatus[] = [
      "online",
      "online",
      "idle",
      "suspended",
      "rate_limited",
    ];

    expect(countAccountTabs(statuses)).toEqual({
      all: 5,
      online: 2,
      rate_limited: 1,
      offline: 1,
      disabled: 1,
    });
  });
});

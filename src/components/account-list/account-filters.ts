// 账号管理的状态筛选页签（全部 / 在线 / 限流 / 离线 / 已停用）：纯函数，单 feature 留本地。
// 「离线」= 空闲 + 已离线（都还没连上、可以「重连」）；「已停用」= 两个终态。

import type { AccountStatus } from "@/lib/account-transitions";

export const ACCOUNT_TABS = [
  "all",
  "online",
  "rate_limited",
  "offline",
  "disabled",
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export const ACCOUNT_TAB_LABELS: Readonly<Record<AccountTab, string>> = {
  all: "全部",
  online: "在线",
  rate_limited: "限流",
  offline: "离线",
  disabled: "已停用",
};

const TAB_STATUSES: Readonly<
  Record<Exclude<AccountTab, "all">, readonly AccountStatus[]>
> = {
  online: ["online"],
  rate_limited: ["rate_limited"],
  offline: ["idle", "disconnected"],
  disabled: ["suspended", "session_expired"],
};

export function matchesAccountTab(
  status: AccountStatus,
  tab: AccountTab,
): boolean {
  return tab === "all" || TAB_STATUSES[tab].includes(status);
}

/** 每个页签下有几个账号（页签上的计数）。 */
export function countAccountTabs(
  statuses: readonly AccountStatus[],
): Record<AccountTab, number> {
  return Object.fromEntries(
    ACCOUNT_TABS.map((tab) => [
      tab,
      statuses.filter((status) => matchesAccountTab(status, tab)).length,
    ]),
  ) as Record<AccountTab, number>;
}

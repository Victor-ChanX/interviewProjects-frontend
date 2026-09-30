// 账号状态转移表（题目 A1；与后端 src/services/account-service.ts 的 TRANSITIONS 同一份）。
// 前端只用它决定「哪些操作按钮该出现」（前端 #3）：表外的转移不渲染按钮；真正的合法性仍由后端
// 判（409 ILLEGAL_TRANSITION / CAS_CONFLICT），这里不是权威。
// 状态取值从 api.generated 派生，后端加状态时 tsc 会把这张表标红。

import type { components } from "@/types/api.generated";

export type AccountStatus = components["schemas"]["AccountStatus"];

/** 行 = 当前状态，列 = 目标状态；终态没有出边，同状态到同状态不在表上。 */
export const ACCOUNT_TRANSITIONS: Readonly<
  Record<AccountStatus, readonly AccountStatus[]>
> = Object.freeze({
  idle: ["online", "suspended", "session_expired"],
  online: [
    "idle",
    "rate_limited",
    "disconnected",
    "suspended",
    "session_expired",
  ],
  rate_limited: ["online", "disconnected", "suspended", "session_expired"],
  disconnected: ["idle", "online", "suspended", "session_expired"],
  suspended: [],
  session_expired: [],
});

export const ACCOUNT_STATUSES = Object.keys(
  ACCOUNT_TRANSITIONS,
) as readonly AccountStatus[];

/** 终态：没有出边，重连也不能恢复（A1）。 */
export const TERMINAL_ACCOUNT_STATUSES: readonly AccountStatus[] =
  Object.freeze(["suspended", "session_expired"]);

export function allowedTransitions(
  status: AccountStatus,
): readonly AccountStatus[] {
  return ACCOUNT_TRANSITIONS[status];
}

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  return ACCOUNT_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: AccountStatus): boolean {
  return TERMINAL_ACCOUNT_STATUSES.includes(status);
}

/**
 * 账号列表的三个操作（题目第 4 节页面 2）：
 * - markOffline「标记离线」= transition → disconnected（online / rate_limited 合法）
 * - reconnect「重连」= POST connect（后端只接受 idle / disconnected，不是转移表的 → online 全集：
 *   rate_limited → online 是到期自动回，不给操作员按钮）
 * - release「释放账号」= transition → idle（online / disconnected 合法）
 */
export type AccountAction = "markOffline" | "reconnect" | "release";

export const ACCOUNT_ACTIONS: readonly AccountAction[] = Object.freeze([
  "markOffline",
  "reconnect",
  "release",
]);

/** 每个操作对应的目标状态（reconnect 走 connect 端点，但合法性口径仍是 → online）。 */
export const ACCOUNT_ACTION_TARGET: Readonly<
  Record<AccountAction, AccountStatus>
> = Object.freeze({
  markOffline: "disconnected",
  reconnect: "online",
  release: "idle",
});

const CONNECTABLE_STATUSES: readonly AccountStatus[] = Object.freeze([
  "idle",
  "disconnected",
]);

export function canPerformAction(
  status: AccountStatus,
  action: AccountAction,
): boolean {
  if (action === "reconnect") return CONNECTABLE_STATUSES.includes(status);

  return canTransition(status, ACCOUNT_ACTION_TARGET[action]);
}

/** 当前状态下可以出现的按钮，按固定顺序（标记离线 / 重连 / 释放账号）。 */
export function availableActions(
  status: AccountStatus,
): readonly AccountAction[] {
  return ACCOUNT_ACTIONS.filter((action) => canPerformAction(status, action));
}

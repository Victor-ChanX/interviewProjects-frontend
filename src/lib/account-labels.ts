// 账号状态 → 中文文案 / 徽标语气。账号管理、工作台、实时动态共用
// （frontend-component-splitting split.promote-shared：被 2+ feature 用到就提升）。
// 文案与后端仓 docs/manual-testing.md 的用例一致（「在线」「限流中」「已停用（终态）」）。

import type { AccountStatus } from "@/lib/account-transitions";
import type { StatusTone } from "@/lib/status-tone";

export const ACCOUNT_STATUS_LABELS: Readonly<Record<AccountStatus, string>> = {
  idle: "空闲",
  online: "在线",
  rate_limited: "限流中",
  disconnected: "已离线",
  suspended: "已停用",
  session_expired: "会话失效",
};

export const ACCOUNT_STATUS_TONE: Readonly<Record<AccountStatus, StatusTone>> =
  {
    idle: "neutral",
    online: "success",
    rate_limited: "warning",
    disconnected: "muted",
    suspended: "danger",
    session_expired: "danger",
  };

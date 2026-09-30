import type { FilterTabOption } from "@/components/ui-atoms/filter-tabs";
import type { AccountAction } from "@/lib/account-transitions";
import type { AccountStatus } from "@/services/account-service";

import type { AccountTab } from "./account-filters";

/** 题目第 4 节页面 2 的三个按钮文案（hook 的 toast 与 view 的按钮共用）。 */
export const ACCOUNT_ACTION_LABELS: Readonly<Record<AccountAction, string>> = {
  markOffline: "标记离线",
  reconnect: "重连",
  release: "释放账号",
};

/** 渲染就绪的一行：hook 已按转移表 + canWrite 算好 actions，view 只管画。 */
export interface AccountRow {
  id: string;
  status: AccountStatus;
  platformUserId: string | null;
  rateLimitedUntil: string | null;
  /** rateLimitedUntil 的相对时间文案（「3分钟后」）；非 rate_limited 为 null。 */
  rateLimitedUntilLabel: string | null;
  /** 终态（suspended / session_expired）：醒目展示，没有任何按钮。 */
  terminal: boolean;
  actions: readonly AccountAction[];
}

export interface AccountListViewProps {
  /** 当前页签下的行。 */
  rows: AccountRow[];
  /** 全部账号数（页签之前）。 */
  total: number;
  tab: AccountTab;
  tabs: FilterTabOption<AccountTab>[];
  onTabChange: (tab: AccountTab) => void;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  /** 正在提交操作的账号 id：该行按钮禁用。 */
  pendingId: string | null;
  onAction: (id: string, action: AccountAction) => void;
  onRetry: () => void;
}

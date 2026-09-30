// container：数据编排、筛选页签（URL）与实时订阅；渲染就绪的行与回调通过 props 交给 view。
// 权限分支（viewer 不渲染按钮）已在 hook 里按 useSession().canWrite 算进每行的 actions。

import { useCallback, useMemo } from "react";

import { useAccountEvents } from "@/hooks/use-account-events";

import {
  ACCOUNT_TAB_LABELS,
  ACCOUNT_TABS,
  type AccountTab,
  countAccountTabs,
  matchesAccountTab,
} from "./account-filters";
import { AccountListView } from "./account-list-view";
import { useAccountList } from "./use-account-list";
import { useAccountTab } from "./use-account-tab";

export function AccountListContainer() {
  const list = useAccountList();
  const [tab, setTab] = useAccountTab();

  useAccountEvents();

  const { rows } = list;
  const counts = useMemo(
    () => countAccountTabs(rows.map((row) => row.status)),
    [rows],
  );
  const visible = useMemo(
    () => rows.filter((row) => matchesAccountTab(row.status, tab)),
    [rows, tab],
  );
  const tabs = useMemo(
    () =>
      ACCOUNT_TABS.map((value) => ({
        value,
        label: ACCOUNT_TAB_LABELS[value],
        count: counts[value],
      })),
    [counts],
  );

  const onTabChange = useCallback(
    (next: AccountTab) => {
      void setTab(next === "all" ? null : next);
    },
    [setTab],
  );

  return (
    <AccountListView
      rows={visible}
      total={rows.length}
      tab={tab}
      tabs={tabs}
      onTabChange={onTabChange}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      pendingId={list.pendingId}
      onAction={list.onAction}
      onRetry={list.onRetry}
    />
  );
}

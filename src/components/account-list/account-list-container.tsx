// container：数据编排与筛选页签（URL）；渲染就绪的行与回调通过 props 交给 view。
// 账号状态事件由应用壳里的 useAccountEvents 同步进缓存（不论挂着哪个页面）。
// 权限分支（viewer 不渲染按钮）已在 hook 里按 useSession().canWrite 算进每行的 actions；「新增账号」（前端 #26）
// 同样只给 admin，表单 / 提交在 use-create-account。

import { useCallback, useMemo } from "react";

import { useSession } from "@/hooks/use-session";

import {
  ACCOUNT_TAB_LABELS,
  ACCOUNT_TABS,
  type AccountTab,
  countAccountTabs,
  matchesAccountTab,
} from "./account-filters";
import { AccountListView } from "./account-list-view";
import type { CreateAccountDialogViewProps } from "./types";
import { useAccountList } from "./use-account-list";
import { useAccountTab } from "./use-account-tab";
import { useCreateAccount } from "./use-create-account";

export function AccountListContainer() {
  const list = useAccountList();
  const [tab, setTab] = useAccountTab();
  const canWrite = useSession()?.canWrite ?? false;
  const create = useCreateAccount();
  const { setOpen: setCreateOpen } = create;

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

  const createDialog = useMemo<CreateAccountDialogViewProps | null>(
    () =>
      canWrite
        ? {
            open: create.open,
            onOpenChange: create.setOpen,
            register: create.register,
            errors: create.errors,
            submitting: create.submitting,
            onSubmit: create.submit,
          }
        : null,
    [canWrite, create],
  );

  const onCreate = useCallback(() => {
    setCreateOpen(true);
  }, [setCreateOpen]);

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
      createDialog={createDialog}
      onCreate={onCreate}
    />
  );
}

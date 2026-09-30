// container：数据编排与实时订阅；渲染就绪的行与回调通过 props 交给 view。
// 权限分支（viewer 不渲染按钮）已在 hook 里按 useSession().canWrite 算进每行的 actions。

import { useAccountEvents } from "@/hooks/use-account-events";

import { AccountListView } from "./account-list-view";
import { useAccountList } from "./use-account-list";

export function AccountListContainer() {
  const list = useAccountList();

  useAccountEvents();

  return (
    <AccountListView
      rows={list.rows}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      pendingId={list.pendingId}
      onAction={list.onAction}
      onRetry={list.onRetry}
    />
  );
}

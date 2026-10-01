// view：账号管理。标题行 + 状态筛选页签 + DataTable（账号 / 状态 / 平台用户 ID / 限流到期 / 操作）。
// 纯展示：不 fetch、不 toast、不做路由、不碰 storage、不知道有实时连接。操作按钮已按转移表 + 权限算好。

import { Plus, RefreshCw, UserRound } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { FilterTabs } from "@/components/ui-atoms/filter-tabs";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
} from "@/lib/account-labels";
import type { AccountAction } from "@/lib/account-transitions";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { CreateAccountDialogView } from "./create-account-dialog-view";
import {
  ACCOUNT_ACTION_LABELS,
  type AccountListViewProps,
  type AccountRow,
} from "./types";

const col = dataTableColumnHelper<AccountRow>();

const Dash = () => <span className="text-muted-foreground">-</span>;

function buildColumns(
  pendingId: string | null,
  onAction: (id: string, action: AccountAction) => void,
) {
  return col.columns([
    col.accessor("id", {
      header: "账号 ID",
      meta: { label: "账号 ID", className: "w-40" },
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-mono text-xs font-medium">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-3.5" />
          </span>
          {row.original.id}
        </span>
      ),
    }),
    col.accessor("status", {
      header: "状态",
      meta: { label: "状态", className: "w-36" },
      cell: ({ row }) => (
        <StatusBadge tone={ACCOUNT_STATUS_TONE[row.original.status]}>
          {ACCOUNT_STATUS_LABELS[row.original.status]}
          {row.original.terminal ? "（终态）" : null}
        </StatusBadge>
      ),
    }),
    col.accessor("platformUserId", {
      header: "平台用户 ID",
      meta: { label: "平台用户 ID" },
      cell: ({ row }) =>
        row.original.platformUserId ? (
          <span className="font-mono text-xs">
            {row.original.platformUserId}
          </span>
        ) : (
          <Dash />
        ),
    }),
    col.accessor("rateLimitedUntilLabel", {
      header: "限流到期",
      meta: { label: "限流到期", className: "w-32" },
      cell: ({ row }) =>
        row.original.rateLimitedUntilLabel ? (
          <time
            dateTime={row.original.rateLimitedUntil ?? undefined}
            className="text-warning"
          >
            {row.original.rateLimitedUntilLabel}
          </time>
        ) : (
          <Dash />
        ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="block text-right">操作</span>,
      meta: { className: "w-64 text-right" },
      cell: ({ row }) =>
        row.original.actions.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {row.original.terminal ? "不可恢复" : "-"}
          </span>
        ) : (
          <div className="flex justify-end gap-2">
            {row.original.actions.map((action) => (
              <Button
                key={action}
                size="sm"
                variant={
                  action === "release"
                    ? "destructive"
                    : action === "reconnect"
                      ? "default"
                      : "outline"
                }
                disabled={pendingId === row.original.id}
                onClick={() => onAction(row.original.id, action)}
              >
                {ACCOUNT_ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        ),
    }),
  ]);
}

export function AccountListView({
  rows,
  total,
  tab,
  tabs,
  onTabChange,
  loading,
  error,
  retrying,
  pendingId,
  onAction,
  onRetry,
  createDialog,
  onCreate,
}: AccountListViewProps) {
  const columns = useMemo(
    () => buildColumns(pendingId, onAction),
    [onAction, pendingId],
  );

  return (
    <>
      <PageHeader
        title="账号管理"
        description={`托管的服务账号及其与消息网关的连接状态（共 ${total} 个）；操作按钮只显示当前状态下合法的转移。`}
        actions={
          <>
            <Button variant="outline" onClick={onRetry} disabled={retrying}>
              <RefreshCw className={cn({ "animate-spin": retrying })} />
              刷新
            </Button>
            {createDialog ? (
              <Button onClick={onCreate}>
                <Plus />
                新增账号
              </Button>
            ) : null}
          </>
        }
      />

      {createDialog ? <CreateAccountDialogView {...createDialog} /> : null}

      {error ? (
        <QueryError
          title="账号列表加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={rows}
              getRowId={(row) => row.id}
              loading={loading}
              emptyTitle={tab === "all" ? "暂无账号" : "这个状态下没有账号"}
              rowClassName={(row) =>
                row.terminal
                  ? "bg-destructive/5 hover:bg-destructive/10"
                  : undefined
              }
              toolbar={
                <FilterTabs
                  aria-label="按状态筛选"
                  value={tab}
                  onValueChange={onTabChange}
                  options={tabs}
                />
              }
              testId="account-table"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

// view：纯展示，props 进回调出。不 fetch、不 toast、不做路由、不碰 storage、不知道有实时连接。
// 表格用原生 <table>：共享 DataTable（ui-atoms）尚未落地，四列只读表不值得先造它；出现第二张表时再提升。

import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AccountStatus } from "@/services/account-service";

import {
  ACCOUNT_ACTION_LABELS,
  type AccountListViewProps,
  type AccountRow,
} from "./types";

const STATUS_LABELS: Readonly<Record<AccountStatus, string>> = {
  idle: "空闲",
  online: "在线",
  rate_limited: "限流中",
  disconnected: "已离线",
  suspended: "已停用",
  session_expired: "会话失效",
};

/** 状态 → Badge 样式：全部走主题 token（success / warning / destructive / muted），不写死颜色。 */
const STATUS_BADGE_CLASS: Readonly<Record<AccountStatus, string>> = {
  idle: "border-border bg-muted text-muted-foreground",
  online: "border-success/40 bg-success/15 text-success",
  rate_limited: "border-warning/40 bg-warning/15 text-warning",
  disconnected: "border-border bg-background text-muted-foreground",
  suspended: "border-destructive/40 bg-destructive/15 text-destructive",
  session_expired: "border-destructive/40 bg-destructive/15 text-destructive",
};

const HEADERS = ["账号 ID", "状态", "平台用户 ID", "限流到期", "操作"] as const;

function AccountStatusBadge({ row }: { row: AccountRow }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_BADGE_CLASS[row.status], {
        "ring-2 ring-destructive/30": row.terminal,
      })}
    >
      {STATUS_LABELS[row.status]}
      {row.terminal ? "（终态）" : null}
    </Badge>
  );
}

export function AccountListView({
  rows,
  loading,
  error,
  retrying,
  pendingId,
  onAction,
  onRetry,
}: AccountListViewProps) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">账号列表</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw className={cn("size-4", { "animate-spin": retrying })} />
          刷新
        </Button>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm">
          <p className="text-destructive">账号列表加载失败</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onRetry}
            disabled={retrying}
          >
            重试
          </Button>
        </div>
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-md bg-muted" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无账号</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {HEADERS.map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn({ "bg-destructive/5": row.terminal })}
                >
                  <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                  <td className="px-3 py-2">
                    <AccountStatusBadge row={row} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.platformUserId ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.rateLimitedUntilLabel ? (
                      <time
                        dateTime={row.rateLimitedUntil ?? undefined}
                        className="text-warning"
                      >
                        {row.rateLimitedUntilLabel}
                      </time>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.actions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {row.terminal ? "不可恢复" : "-"}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {row.actions.map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant={
                              action === "release" ? "destructive" : "outline"
                            }
                            disabled={pendingId === row.id}
                            onClick={() => onAction(row.id, action)}
                          >
                            {ACCOUNT_ACTION_LABELS[action]}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

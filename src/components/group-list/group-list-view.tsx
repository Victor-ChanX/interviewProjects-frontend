// view：纯展示，props 进回调出。原生 <table>：共享 DataTable（ui-atoms）尚未落地，四列只读表不值得先造它。

import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/services/group-service";

import type { GroupListViewProps } from "./types";

const STATUS_LABELS: Readonly<Record<GroupStatus, string>> = {
  active: "正常",
  unreachable: "不可达",
  left: "已退群",
};

/** 群状态 → 徽标样式，走主题 token。 */
const STATUS_CLASS: Readonly<Record<GroupStatus, string>> = {
  active: "border-success/40 bg-success/15 text-success",
  unreachable: "border-destructive/40 bg-destructive/15 text-destructive",
  left: "border-border bg-muted text-muted-foreground",
};

const HEADERS = ["群 ID", "状态", "成员数", "Agent", "进行中的 run"] as const;

export function GroupListView({
  groups,
  loading,
  error,
  retrying,
  onRetry,
  onOpen,
}: GroupListViewProps) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">群列表</h1>
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
        <QueryError
          title="群列表加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-md bg-muted" />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无群</p>
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
              {groups.map((group) => (
                <tr
                  key={group.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => onOpen(group.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(group.id);
                      }}
                    >
                      {group.id}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn("font-medium", STATUS_CLASS[group.status])}
                    >
                      {STATUS_LABELS[group.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {group.members.length}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn({
                        "text-success": group.agentEnabled,
                        "text-muted-foreground": !group.agentEnabled,
                      })}
                    >
                      {group.agentEnabled ? "开" : "关"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {group.activeAgentRunId ?? (
                      <span className="font-sans text-muted-foreground">-</span>
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

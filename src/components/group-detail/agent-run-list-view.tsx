// 某群的 agent run 列表：纯展示，最新在前。blocked（审计拦下）醒目：顶部 Alert + 行高亮；
// 当前进行中的 run（activeRunId）行加左侧强调。原生 <table>：共享 DataTable 尚未落地。

import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui-atoms/query-error";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type {
  AgentRunEndReason,
  AgentRunStatus,
} from "@/services/agent-run-service";

import type { AgentRunListViewProps } from "./types";

const STATUS_LABELS: Readonly<Record<AgentRunStatus, string>> = {
  running: "运行中",
  finished: "已完成",
  failed: "失败",
  blocked: "已拦截",
  cancelled: "已取消",
};

/** 状态 → 徽标样式：全部走主题 token。 */
const STATUS_CLASS: Readonly<Record<AgentRunStatus, string>> = {
  running: "border-warning/40 bg-warning/15 text-warning",
  finished: "border-success/40 bg-success/15 text-success",
  failed: "border-destructive/40 bg-destructive/15 text-destructive",
  blocked:
    "border-destructive bg-destructive/25 font-semibold text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const END_REASON_LABELS: Readonly<Record<AgentRunEndReason, string>> = {
  final: "正常结束",
  budget_exhausted: "预算耗尽",
  wall_clock: "超时",
  protocol_errors: "协议错误过多",
  audit_blocked: "审计拦截",
  cancelled: "被取消",
};

const HEADERS = [
  "Run ID",
  "状态",
  "结束原因",
  "步数",
  "耗时 / 预算",
  "创建时间",
  "摘要",
] as const;

export function AgentRunListView({
  runs,
  loading,
  error,
  retrying,
  activeRunId,
  onRetry,
}: AgentRunListViewProps) {
  if (error)
    return (
      <QueryError
        title="Agent run 列表加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading)
    return <div className="h-32 animate-pulse rounded-md bg-muted" />;

  if (runs.length === 0)
    return <p className="text-sm text-muted-foreground">暂无 agent run</p>;

  const blocked = runs.filter((run) => run.status === "blocked");

  return (
    <div className="flex flex-col gap-3">
      {blocked.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            有 {blocked.length} 次运行被审计拦截（blocked）
          </AlertTitle>
          <AlertDescription>
            {blocked.map((run) => (
              <p key={run.id} className="font-mono text-xs">
                {run.id}
                {run.summary ? ` — ${run.summary}` : null}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

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
            {runs.map((run) => (
              <tr
                key={run.id}
                className={cn({
                  "bg-destructive/10": run.status === "blocked",
                  "border-l-2 border-l-primary": run.id === activeRunId,
                })}
              >
                <td className="px-3 py-2 font-mono text-xs">
                  {run.id}
                  {run.id === activeRunId ? (
                    <span className="ml-1 font-sans text-muted-foreground">
                      （进行中）
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", STATUS_CLASS[run.status])}
                  >
                    {STATUS_LABELS[run.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {run.endReason ? (
                    END_REASON_LABELS[run.endReason]
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {run.stepCount} / {run.maxSteps}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {Math.round(run.accumulatedMs / 1000)}s /{" "}
                  {Math.round(run.budgetMs / 1000)}s
                </td>
                <td className="px-3 py-2">
                  <time dateTime={run.createdAt}>
                    {formatDateTime(run.createdAt)}
                  </time>
                </td>
                <td
                  className="max-w-xs truncate px-3 py-2"
                  title={run.summary ?? undefined}
                >
                  {run.summary ?? (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

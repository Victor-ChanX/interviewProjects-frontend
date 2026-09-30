// 某群的 Agent 运行：DataTable，最新在前。blocked（审计拦下）醒目：顶部 Alert + 整行标红；
// 当前进行中的那一次左侧强调；run 链接到详情页。状态 / 结束原因的文案在 @/lib/agent-run-labels。

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STATUS_TONE,
} from "@/lib/agent-run-labels";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { shortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";
import type { AgentRunRead } from "@/services/agent-run-service";

import type { AgentRunListViewProps } from "./types";

const col = dataTableColumnHelper<AgentRunRead>();

const Dash = () => <span className="text-muted-foreground">-</span>;

function buildColumns(activeRunId: string | null) {
  return col.columns([
    col.accessor("id", {
      header: "运行",
      meta: { label: "运行", className: "w-36" },
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <Link
            to={`/agent-runs/${encodeURIComponent(row.original.id)}`}
            className="font-mono text-xs font-medium text-primary hover:underline"
            title={row.original.id}
            data-run-id={row.original.id}
          >
            {shortId(row.original.id)}
          </Link>
          {row.original.id === activeRunId ? (
            <span className="text-xs text-muted-foreground">进行中</span>
          ) : null}
        </span>
      ),
    }),
    col.accessor("status", {
      header: "状态",
      meta: { label: "状态", className: "w-28" },
      cell: ({ row }) => (
        <StatusBadge
          tone={AGENT_RUN_STATUS_TONE[row.original.status]}
          pulse={row.original.status === "running"}
        >
          {AGENT_RUN_STATUS_LABELS[row.original.status]}
        </StatusBadge>
      ),
    }),
    col.accessor("endReason", {
      header: "结束原因",
      meta: { label: "结束原因", className: "w-28" },
      cell: ({ row }) =>
        row.original.endReason ? (
          AGENT_RUN_END_REASON_LABELS[row.original.endReason]
        ) : (
          <Dash />
        ),
    }),
    col.accessor("stepCount", {
      header: "步数",
      meta: { label: "步数", className: "w-20 tabular-nums" },
      cell: ({ row }) => `${row.original.stepCount} / ${row.original.maxSteps}`,
    }),
    col.accessor("accumulatedMs", {
      header: "耗时 / 预算",
      meta: { label: "耗时 / 预算", className: "w-28 tabular-nums" },
      cell: ({ row }) =>
        `${Math.round(row.original.accumulatedMs / 1000)}s / ${Math.round(row.original.budgetMs / 1000)}s`,
    }),
    col.accessor("createdAt", {
      header: "创建时间",
      meta: { label: "创建时间", className: "w-36" },
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt}>
          {formatDateTime(row.original.createdAt)}
        </time>
      ),
    }),
    col.accessor("summary", {
      header: "摘要",
      meta: { label: "摘要", className: "max-w-xs" },
      cell: ({ row }) =>
        row.original.summary ? (
          <span className="block truncate" title={row.original.summary}>
            {row.original.summary}
          </span>
        ) : (
          <Dash />
        ),
    }),
  ]);
}

export function AgentRunListView({
  runs,
  loading,
  error,
  retrying,
  activeRunId,
  onRetry,
}: AgentRunListViewProps) {
  const columns = useMemo(() => buildColumns(activeRunId), [activeRunId]);

  if (error)
    return (
      <QueryError
        title="Agent 运行加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  const blocked = runs.filter((run) => run.status === "blocked");

  return (
    <div className="flex flex-col gap-3">
      {blocked.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            有 {blocked.length} 次运行被拦下（审计拿不到结论）
          </AlertTitle>
          <AlertDescription>
            对应的工具没有执行；点运行 ID 看是哪一步。
          </AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={runs}
        getRowId={(run) => run.id}
        loading={loading}
        emptyTitle="暂无 Agent 运行"
        emptyDescription="打开「Agent 自动回复」后，外部成员发言就会触发一次运行。"
        rowClassName={(run) =>
          cn({
            "bg-destructive/8 hover:bg-destructive/12":
              run.status === "blocked",
            "shadow-[inset_3px_0_0_var(--primary)]": run.id === activeRunId,
          })
        }
        initialHiddenColumns={["accumulatedMs"]}
        testId="agent-run-list"
      />
    </div>
  );
}

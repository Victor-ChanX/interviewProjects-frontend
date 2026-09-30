// 运行进度：纯展示。头部（run id / 状态 / 当前步 / 创建与结束时间）+ 步骤 DataTable
// （# / 状态 / 角色 / 延迟 / 排期 / 发出 / 发送账号 / clientMsgId / 失败码 / 取值与来源）。
// 当前步（currentStepIndex）行左侧强调。

import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import type { StatusTone } from "@/lib/status-tone";
import type {
  SequenceRunStatus,
  SequenceRunStepRead,
  SequenceStepStatus,
} from "@/services/sequence-service";

import type { SequenceRunProgressViewProps } from "./types";

const RUN_STATUS: Readonly<
  Record<SequenceRunStatus, { label: string; tone: StatusTone }>
> = {
  running: { label: "运行中", tone: "info" },
  finished: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  stopped: { label: "已停止", tone: "muted" },
};

const STEP_STATUS: Readonly<
  Record<SequenceStepStatus, { label: string; tone: StatusTone }>
> = {
  pending: { label: "待发", tone: "neutral" },
  accepted: { label: "已受理", tone: "info" },
  sent: { label: "已发出", tone: "success" },
  skipped: { label: "已跳过", tone: "warning" },
  failed: { label: "失败", tone: "danger" },
};

const col = dataTableColumnHelper<SequenceRunStepRead>();

const Dash = () => <span className="text-muted-foreground">-</span>;

const COLUMNS = col.columns([
  col.accessor("index", {
    header: "#",
    meta: { className: "w-10 tabular-nums" },
  }),
  col.accessor("status", {
    header: "状态",
    meta: { label: "状态", className: "w-24" },
    cell: ({ row }) => (
      <StatusBadge
        tone={STEP_STATUS[row.original.status].tone}
        pulse={row.original.status === "accepted"}
      >
        {STEP_STATUS[row.original.status].label}
      </StatusBadge>
    ),
  }),
  col.accessor("accountRole", {
    header: "角色",
    meta: { label: "角色", className: "w-20" },
    cell: ({ row }) =>
      row.original.accountRole === "admin" ? "管理员" : "成员",
  }),
  col.accessor("delaySeconds", {
    header: "延迟",
    meta: { label: "延迟", className: "w-16 tabular-nums" },
    cell: ({ row }) => `${row.original.delaySeconds}s`,
  }),
  col.accessor("scheduledAt", {
    header: "排期",
    meta: { label: "排期", className: "w-36" },
    cell: ({ row }) => (
      <time dateTime={row.original.scheduledAt ?? undefined}>
        {formatDateTime(row.original.scheduledAt)}
      </time>
    ),
  }),
  col.accessor((step) => step.sentAt ?? step.skippedAt, {
    id: "doneAt",
    header: "发出 / 跳过",
    meta: { label: "发出 / 跳过时间", className: "w-36" },
    cell: ({ row }) => {
      const at = row.original.sentAt ?? row.original.skippedAt;

      return <time dateTime={at ?? undefined}>{formatDateTime(at)}</time>;
    },
  }),
  col.accessor("accountId", {
    header: "发送账号",
    meta: { label: "发送账号", className: "w-24" },
    cell: ({ row }) =>
      row.original.accountId ? (
        <span className="font-mono text-xs">{row.original.accountId}</span>
      ) : (
        <Dash />
      ),
  }),
  col.accessor("clientMsgId", {
    header: "clientMsgId",
    meta: { label: "clientMsgId", className: "w-40" },
    cell: ({ row }) =>
      row.original.clientMsgId ? (
        <span className="font-mono text-xs">{row.original.clientMsgId}</span>
      ) : (
        <Dash />
      ),
  }),
  col.accessor("failCode", {
    header: "失败码",
    meta: { label: "失败码", className: "w-32" },
    cell: ({ row }) =>
      row.original.failCode ? (
        <span className="font-mono text-xs text-destructive">
          {row.original.failCode}
        </span>
      ) : (
        <Dash />
      ),
  }),
  col.accessor("resolvedVars", {
    header: "取值（来源）",
    meta: { label: "取值（来源）", className: "min-w-56 whitespace-normal" },
    cell: ({ row }) => {
      const keys = Object.keys(row.original.resolvedVars);

      if (keys.length === 0) return <Dash />;

      return (
        <ul className="flex flex-col gap-0.5 text-xs">
          {keys.map((key) => (
            <li key={key} className="break-all">
              <span className="font-mono">{key}</span> ={" "}
              {row.original.resolvedVars[key]}{" "}
              <span className="text-muted-foreground">
                （{row.original.varSources[key] ?? "-"}）
              </span>
            </li>
          ))}
        </ul>
      );
    },
  }),
]);

export function SequenceRunProgressView({
  run,
  loading,
  error,
  retrying,
  onRetry,
}: SequenceRunProgressViewProps) {
  const current = run?.status === "running" ? run.currentStepIndex : null;
  const rowClassName = useMemo(
    () => (step: SequenceRunStepRead) =>
      step.index === current
        ? "shadow-[inset_3px_0_0_var(--primary)] bg-primary/5"
        : undefined,
    [current],
  );

  if (error)
    return (
      <QueryError
        title="序列运行加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !run) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge
          tone={RUN_STATUS[run.status].tone}
          pulse={run.status === "running"}
          data-testid="sequence-run-status"
        >
          {RUN_STATUS[run.status].label}
        </StatusBadge>
        <span className="text-sm tabular-nums">
          当前步 {run.currentStepIndex} / {run.steps.length}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {run.id}
        </span>
        <span className="text-xs text-muted-foreground">
          创建 {formatDateTime(run.createdAt)} · 结束{" "}
          {formatDateTime(run.finishedAt)}
        </span>
      </div>

      <DataTable
        columns={COLUMNS}
        data={run.steps}
        getRowId={(step) => String(step.index)}
        rowClassName={rowClassName}
        initialHiddenColumns={["clientMsgId"]}
        testId="sequence-run-steps"
      />
    </div>
  );
}

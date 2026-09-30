// 运行进度：纯展示。头部（run id / 状态 / 当前步 currentStepIndex / 创建与结束时间）+ 步骤表
// （index / 状态 / 角色 / 延迟 / scheduledAt / sentAt / 发送账号 / clientMsgId / 失败码 / 取值与来源）。
// 当前步（currentStepIndex）行加左侧强调。原生 <table>：共享 DataTable 尚未落地（与 group-detail 的 run 列表同口径）。

import { Badge } from "@/components/ui/badge";
import { QueryError } from "@/components/ui-atoms/query-error";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type {
  SequenceRunStatus,
  SequenceStepStatus,
} from "@/services/sequence-service";

import type { SequenceRunProgressViewProps } from "./types";

const RUN_STATUS_LABELS: Readonly<Record<SequenceRunStatus, string>> = {
  running: "运行中",
  finished: "已完成",
  failed: "失败",
  stopped: "已停止",
};

/** 状态 → 徽标样式，走主题 token。 */
const RUN_STATUS_CLASS: Readonly<Record<SequenceRunStatus, string>> = {
  running: "border-warning/40 bg-warning/15 text-warning",
  finished: "border-success/40 bg-success/15 text-success",
  failed: "border-destructive/40 bg-destructive/15 text-destructive",
  stopped: "border-border bg-muted text-muted-foreground",
};

const STEP_STATUS_LABELS: Readonly<Record<SequenceStepStatus, string>> = {
  pending: "待发",
  accepted: "已受理",
  sent: "已发出",
  skipped: "已跳过",
  failed: "失败",
};

const STEP_STATUS_CLASS: Readonly<Record<SequenceStepStatus, string>> = {
  pending: "border-border bg-muted text-muted-foreground",
  accepted: "border-warning/40 bg-warning/15 text-warning",
  sent: "border-success/40 bg-success/15 text-success",
  skipped: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/40 bg-destructive/15 text-destructive",
};

const HEADERS = [
  "#",
  "状态",
  "角色",
  "延迟",
  "排期",
  "发出",
  "发送账号",
  "clientMsgId",
  "失败码",
  "取值（来源）",
] as const;

const Dash = () => <span className="text-muted-foreground">-</span>;

export function SequenceRunProgressView({
  run,
  loading,
  error,
  retrying,
  onRetry,
}: SequenceRunProgressViewProps) {
  if (error)
    return (
      <QueryError
        title="序列运行加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !run)
    return <div className="h-40 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{run.id}</span>
        <Badge
          variant="outline"
          className={cn("font-medium", RUN_STATUS_CLASS[run.status])}
        >
          {RUN_STATUS_LABELS[run.status]}
        </Badge>
        <span className="text-sm tabular-nums">
          当前步 {run.currentStepIndex} / {run.steps.length}
        </span>
        <span className="text-xs text-muted-foreground">
          创建 {formatDateTime(run.createdAt)} · 结束{" "}
          {formatDateTime(run.finishedAt)}
        </span>
      </div>

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
            {run.steps.map((step) => {
              const keys = Object.keys(step.resolvedVars);

              return (
                <tr
                  key={step.index}
                  className={cn("align-top", {
                    "border-l-2 border-l-primary":
                      run.status === "running" &&
                      step.index === run.currentStepIndex,
                  })}
                >
                  <td className="px-3 py-2 tabular-nums">{step.index}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        STEP_STATUS_CLASS[step.status],
                      )}
                    >
                      {STEP_STATUS_LABELS[step.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{step.accountRole}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {step.delaySeconds}s
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <time dateTime={step.scheduledAt ?? undefined}>
                      {formatDateTime(step.scheduledAt)}
                    </time>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <time dateTime={step.sentAt ?? step.skippedAt ?? undefined}>
                      {formatDateTime(step.sentAt ?? step.skippedAt)}
                    </time>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {step.accountId ?? <Dash />}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {step.clientMsgId ?? <Dash />}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {step.failCode ?? <Dash />}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {keys.length === 0 ? (
                      <Dash />
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {keys.map((key) => (
                          <li key={key} className="break-all">
                            <span className="font-mono">{key}</span>={" "}
                            {step.resolvedVars[key]}{" "}
                            <span className="text-muted-foreground">
                              （{step.varSources[key] ?? "-"}）
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

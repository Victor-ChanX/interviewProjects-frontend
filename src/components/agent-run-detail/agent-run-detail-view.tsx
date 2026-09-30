// Agent run 详情的布局：纯展示，props 进回调出。头部（run id / 群链接 / 状态 / 结束原因 / summary / 步数）
// + blocked 的 destructive Alert + 步骤表 + 原始响应浮层。不 fetch、不 toast、不做路由，不知道有实时连接。

import { AlertTriangle } from "lucide-react";
import { Link } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueryError } from "@/components/ui-atoms/query-error";
import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_CLASS,
  AGENT_RUN_STATUS_LABELS,
} from "@/lib/agent-run-labels";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { AgentStepTableView } from "./agent-step-table-view";
import { RawResponseDialogView } from "./raw-response-dialog-view";
import type { AgentRunDetailViewProps } from "./types";

export function AgentRunDetailView({
  run,
  loading,
  error,
  retrying,
  onRetry,
  connection,
  blocked,
  steps,
  rawDialog,
}: AgentRunDetailViewProps) {
  if (error)
    return (
      <QueryError
        title="Agent run 加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !run)
    return (
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/groups/${encodeURIComponent(run.groupId)}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 群 {run.groupId}
          </Link>
          <h1 className="font-mono text-lg font-semibold">{run.id}</h1>
          <Badge
            variant="outline"
            className={cn("font-medium", AGENT_RUN_STATUS_CLASS[run.status])}
          >
            {AGENT_RUN_STATUS_LABELS[run.status]}
          </Badge>
          {run.status === "running" ? (
            <span
              className={cn("text-xs", {
                "text-success": connection === "open",
                "text-muted-foreground": connection !== "open",
              })}
            >
              {connection === "open" ? "实时" : "离线"}
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">结束原因</dt>
            <dd>
              {run.endReason ? (
                AGENT_RUN_END_REASON_LABELS[run.endReason]
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">步数</dt>
            <dd className="tabular-nums">
              {run.stepCount} / {run.maxSteps}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">耗时 / 预算</dt>
            <dd className="tabular-nums">
              {Math.round(run.accumulatedMs / 1000)}s /{" "}
              {Math.round(run.budgetMs / 1000)}s
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">创建 / 结束</dt>
            <dd>
              <time dateTime={run.createdAt}>
                {formatDateTime(run.createdAt)}
              </time>
              {" / "}
              <time dateTime={run.finishedAt ?? undefined}>
                {formatDateTime(run.finishedAt)}
              </time>
            </dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-muted-foreground">摘要</dt>
            <dd className="break-words">
              {run.summary ?? <span className="text-muted-foreground">-</span>}
            </dd>
          </div>
        </dl>
      </header>

      {blocked ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>这次运行被审计拦截（blocked）</AlertTitle>
          <AlertDescription>
            <p>
              审计服务连续 3 次拿不到明确结论，对应工具没有执行，run 已终止
              {run.endReason
                ? `（${AGENT_RUN_END_REASON_LABELS[run.endReason]}）`
                : null}
              。
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>步骤</CardTitle>
          <CardDescription>
            按顺序，含协议错误步；入参可点开看完整 JSON
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentStepTableView {...steps} />
        </CardContent>
      </Card>

      <RawResponseDialogView {...rawDialog} />
    </section>
  );
}

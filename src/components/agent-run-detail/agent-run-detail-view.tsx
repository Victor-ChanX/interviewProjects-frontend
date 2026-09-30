// Agent 运行详情：纯展示，props 进回调出。标题（run id + 状态）→ blocked 的醒目提示 → 指标卡（结束原因 / 步数 /
// 耗时预算 / 触发消息）→ 摘要与触发消息 → 步骤表（可展开入参与协议错误步的原始响应）。

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STATUS_TONE,
} from "@/lib/agent-run-labels";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";

import { AgentStepTableView } from "./agent-step-table-view";
import type { AgentRunDetailViewProps } from "./types";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm" className="gap-1 px-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </Card>
  );
}

export function AgentRunDetailView({
  run,
  loading,
  error,
  retrying,
  onRetry,
  blocked,
  groupName,
}: AgentRunDetailViewProps) {
  if (error)
    return (
      <QueryError
        title="Agent 运行加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !run)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );

  const groupHref = `/groups/${encodeURIComponent(run.groupId)}`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg">{run.id}</span>
            <StatusBadge
              tone={AGENT_RUN_STATUS_TONE[run.status]}
              pulse={run.status === "running"}
              data-testid="agent-run-status"
            >
              {AGENT_RUN_STATUS_LABELS[run.status]}
            </StatusBadge>
          </span>
        }
        description={
          <>
            群{" "}
            <Link
              to={groupHref}
              className="font-mono text-primary hover:underline"
            >
              {groupName}
            </Link>{" "}
            · 创建 {formatDateTime(run.createdAt)} · 结束{" "}
            {formatDateTime(run.finishedAt)}
            {run.status === "running" ? " · 运行中，每 2 秒刷新步骤" : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            render={<Link to={groupHref} />}
            nativeButton={false}
          >
            <ArrowLeft />
            回到群详情
          </Button>
        }
      />

      {blocked ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>这次运行被拦下（blocked）</AlertTitle>
          <AlertDescription>
            审计服务连续 3 次拿不到明确结论，对应工具没有执行，运行已终止
            {run.endReason
              ? `（${AGENT_RUN_END_REASON_LABELS[run.endReason]}）`
              : null}
            。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="结束原因"
          value={
            run.endReason ? AGENT_RUN_END_REASON_LABELS[run.endReason] : "-"
          }
        />
        <Metric label="步数" value={`${run.stepCount} / ${run.maxSteps}`} />
        <Metric
          label="耗时 / 预算"
          value={`${Math.round(run.accumulatedMs / 1000)}s / ${Math.round(run.budgetMs / 1000)}s`}
        />
        <Metric label="触发消息" value={`${run.triggerMessages.length} 条`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>摘要</CardTitle>
            <CardDescription>Agent 结束时给出的一句话总结</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed break-words">
              {run.summary ?? <span className="text-muted-foreground">-</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>触发消息</CardTitle>
            <CardDescription>
              触发这次运行的外部消息；运行期间新到的会合并进下一次
            </CardDescription>
          </CardHeader>
          <CardContent>
            {run.triggerMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {run.triggerMessages.map((message) => (
                  <li
                    key={message.msgId}
                    className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {message.senderPlatformUserId}
                      </span>
                      <time dateTime={message.sentAt}>
                        {formatDateTime(message.sentAt)}
                      </time>
                    </span>
                    <span className="text-sm break-words">{message.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>步骤</CardTitle>
          <CardDescription>
            按顺序，含协议错误步；展开一行看完整入参，协议错误步可看原始响应
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentStepTableView steps={run.steps} />
        </CardContent>
      </Card>
    </>
  );
}

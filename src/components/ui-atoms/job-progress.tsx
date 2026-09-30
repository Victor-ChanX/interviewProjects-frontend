// 异步任务（建群 / 全部退群）的进度块：状态徽标 + 当前步骤 + 失败步骤列表。纯展示，数据由
// src/hooks/use-job-progress.ts 给（调用方经 container 透传）。群列表的新建群弹窗与群详情的全部退群弹窗共用。
// 失败步骤的 code 有中文说明就显示说明并附原码，未知码原样显示。

import { AlertTriangle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  describeJobErrorCode,
  describeJobStep,
  JOB_KIND_LABELS,
  JOB_STATUS_CLASS,
  JOB_STATUS_LABELS,
} from "@/lib/job-labels";
import { cn } from "@/lib/utils";
import type { JobRead } from "@/services/job-service";

export interface JobProgressProps {
  /** 第一次查询还没回来时为 undefined（显示「已提交」）。 */
  job: JobRead | undefined;
  /** 查询失败的整句文案（调用方用 getErrorMessage 派生）；轮询会继续重试。 */
  errorMessage: string | null;
}

export function JobProgress({ job, errorMessage }: JobProgressProps) {
  const status = job?.status ?? "running";

  return (
    <div className="flex flex-col gap-3" data-testid="job-progress">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {job ? (
          <span className="text-muted-foreground">
            {JOB_KIND_LABELS[job.kind]}
          </span>
        ) : null}
        <Badge variant="outline" className={cn(JOB_STATUS_CLASS[status])}>
          {status === "running" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          {JOB_STATUS_LABELS[status]}
        </Badge>
        {job ? (
          <span className="font-mono text-xs text-muted-foreground">
            {job.id}
          </span>
        ) : null}
      </div>

      {status === "running" ? (
        <p className="text-sm">
          <span className="text-muted-foreground">当前步骤：</span>
          {job?.step ? describeJobStep(job.step) : "已提交，等待开始…"}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-xs text-destructive">
          查询进度失败：{errorMessage}（稍后自动重试）
        </p>
      ) : null}

      {job && job.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>有 {job.errors.length} 个步骤失败</AlertTitle>
          <AlertDescription>
            <ul className="flex w-full flex-col gap-1.5">
              {job.errors.map((error, index) => {
                const description = describeJobErrorCode(error.code);

                return (
                  <li
                    key={`${error.step}:${error.code}:${index}`}
                    className="flex flex-col text-xs"
                  >
                    <span>
                      {describeJobStep(error.step)} ·{" "}
                      {description ?? (
                        <span className="font-mono">{error.code}</span>
                      )}
                      {description ? (
                        <span className="ml-1 font-mono opacity-80">
                          （{error.code}）
                        </span>
                      ) : null}
                    </span>
                    {error.message ? (
                      <span className="break-all opacity-80">
                        {error.message}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

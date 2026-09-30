// 序列运行页的布局：纯展示，props 进回调出。标题行（群名 / 回群详情 / 去定时序列）+ 进度卡（有 run 时）
// + 启动表单卡（admin）+ 预检弹窗。不 fetch、不 toast、不做路由，不知道有实时连接。

import { ArrowLeft, ListOrdered } from "lucide-react";
import { Link } from "react-router";

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
import { getErrorMessage } from "@/lib/get-error-message";

import { PreflightDialogView } from "./preflight-dialog-view";
import { SequenceFormView } from "./sequence-form-view";
import { SequenceRunProgressView } from "./sequence-run-progress-view";
import type { SequenceRunViewProps } from "./types";

export function SequenceRunView({
  groupId,
  groupName,
  groupLoading,
  groupError,
  groupRetrying,
  onGroupRetry,
  form,
  preflight,
  progress,
}: SequenceRunViewProps) {
  if (groupError)
    return (
      <QueryError
        title="群详情加载失败"
        message={getErrorMessage(groupError)}
        retrying={groupRetrying}
        onRetry={onGroupRetry}
      />
    );

  if (groupLoading)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );

  return (
    <>
      <PageHeader
        title="序列运行"
        description={
          <>
            在群 <span className="font-mono">{groupName}</span>{" "}
            里按步骤发言：选序列、填占位符取值 → 预检每步每个 key
            的最终取值与来源 → 启动，进度实时更新。
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link to={`/groups/${encodeURIComponent(groupId)}`} />}
              nativeButton={false}
            >
              <ArrowLeft />
              回到群详情
            </Button>
            <Button
              variant="outline"
              render={<Link to="/sequences" />}
              nativeButton={false}
            >
              <ListOrdered />
              定时序列
            </Button>
          </>
        }
      />

      {progress ? (
        <Card>
          <CardHeader>
            <CardTitle>运行进度</CardTitle>
            <CardDescription>
              每步的状态、排期与发送结果；取值与来源按启动时的预检
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SequenceRunProgressView {...progress} />
          </CardContent>
        </Card>
      ) : null}

      {form ? (
        <Card>
          <CardHeader>
            <CardTitle>启动序列</CardTitle>
            <CardDescription>
              还没有合适的序列？先到「定时序列」页新建。vars
              是起始取值，stepVars 从某一步起覆盖。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SequenceFormView {...form} />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          只读账号：只能查看运行进度，不能启动序列。
        </p>
      )}

      <PreflightDialogView {...preflight} />
    </>
  );
}

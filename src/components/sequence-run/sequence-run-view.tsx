// 序列运行页的布局：纯展示，props 进回调出。头部（回群详情 / 实时角标）+ 进度卡（有 run 时）+ 启动表单卡
// + 新建序列的折叠卡（admin）+ 预检弹窗。不 fetch、不 toast、不做路由，不知道有实时连接。
// 「新建序列」的展开 / 收起是纯视觉 state，留在 view。

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { CreateSequenceFormView } from "./create-sequence-form-view";
import { PreflightDialogView } from "./preflight-dialog-view";
import { SequenceFormView } from "./sequence-form-view";
import { SequenceRunProgressView } from "./sequence-run-progress-view";
import type { SequenceRunViewProps } from "./types";

export function SequenceRunView({
  groupId,
  connection,
  groupLoading,
  groupError,
  groupRetrying,
  onGroupRetry,
  form,
  preflight,
  progress,
  createForm,
}: SequenceRunViewProps) {
  const [createOpen, setCreateOpen] = useState(false);

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
      <div className="flex flex-col gap-4">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <Link
          to={`/groups/${encodeURIComponent(groupId)}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 群 {groupId}
        </Link>
        <h1 className="text-lg font-semibold">序列运行</h1>
        <span
          className={cn("text-xs", {
            "text-success": connection === "open",
            "text-muted-foreground": connection !== "open",
          })}
        >
          {connection === "open" ? "实时" : "离线"}
        </span>
      </header>

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
              选序列、填 vars 与 stepVars → 预检（每步每个 key
              的最终取值与来源）→ 启动
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SequenceFormView {...form} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          只读账号：只能查看运行进度，不能启动序列。
        </p>
      )}

      {createForm ? (
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex items-center gap-1 text-left"
              aria-expanded={createOpen}
              onClick={() => setCreateOpen((open) => !open)}
            >
              {createOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <CardTitle>新建序列</CardTitle>
            </button>
            <CardDescription>
              题目 B1 的序列 JSON：name + steps（accountRole / text /
              delaySeconds），文本里用 {"{key}"} 占位
            </CardDescription>
          </CardHeader>
          {/* 收起用 hidden 不用条件渲染：折叠时不卸载表单，填了一半的步骤不会丢。 */}
          <CardContent className={cn({ hidden: !createOpen })}>
            <CreateSequenceFormView {...createForm} />
          </CardContent>
        </Card>
      ) : null}

      <PreflightDialogView {...preflight} />
    </section>
  );
}

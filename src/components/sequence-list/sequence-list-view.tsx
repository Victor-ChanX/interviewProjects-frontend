// view：定时序列。标题行（新建序列）+ DataTable（名称 / 步数 / 占位符 / 总延迟 / 创建时间 / 在群启动），
// 每行可展开看全部步骤。纯展示；对话框由容器给 props。

import { ChevronRight, Play, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type { SequenceRead } from "@/services/sequence-service";

import { CreateSequenceDialogView } from "./create-sequence-dialog-view";
import { formatDelay } from "./sequence-rows";
import { StartSequenceDialogView } from "./start-sequence-dialog-view";
import type { SequenceListViewProps, SequenceRow } from "./types";

const col = dataTableColumnHelper<SequenceRow>();

function buildColumns(
  expanded: ReadonlySet<string>,
  toggle: (id: string) => void,
  canWrite: boolean,
  onStart: (sequence: SequenceRead) => void,
) {
  return col.columns([
    col.display({
      id: "expand",
      header: () => <span className="sr-only">展开</span>,
      meta: { className: "w-8 pr-0" },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={expanded.has(row.original.id) ? "收起步骤" : "展开步骤"}
          aria-expanded={expanded.has(row.original.id)}
          onClick={(event) => {
            event.stopPropagation();
            toggle(row.original.id);
          }}
        >
          <ChevronRight
            className={cn("transition-transform", {
              "rotate-90": expanded.has(row.original.id),
            })}
          />
        </Button>
      ),
    }),
    col.accessor("name", {
      header: "名称",
      meta: { label: "名称", className: "min-w-40" },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    }),
    col.accessor("stepCount", {
      header: "步数",
      meta: { label: "步数", className: "w-16 text-right tabular-nums" },
    }),
    col.accessor("placeholders", {
      header: "占位符",
      meta: { label: "占位符", className: "min-w-40 whitespace-normal" },
      cell: ({ row }) =>
        row.original.placeholders.length === 0 ? (
          <span className="text-muted-foreground">无</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.placeholders.map((key) => (
              <Badge key={key} variant="secondary" className="font-mono">
                {`{${key}}`}
              </Badge>
            ))}
          </div>
        ),
    }),
    col.accessor("totalDelaySeconds", {
      header: "总延迟",
      meta: { label: "总延迟", className: "w-24 tabular-nums" },
      cell: ({ row }) => formatDelay(row.original.totalDelaySeconds),
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
    col.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      meta: { className: "w-28 text-right" },
      cell: ({ row }) =>
        canWrite ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onStart(row.original.sequence);
            }}
          >
            <Play />
            在群启动
          </Button>
        ) : null,
    }),
  ]);
}

function StepList({ sequence }: { sequence: SequenceRead }) {
  return (
    <ol className="flex flex-col gap-2">
      {sequence.steps.map((step) => (
        <li
          key={step.index}
          className="flex flex-wrap items-start gap-2 text-sm"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {step.index}
          </span>
          <StatusBadge
            tone={step.accountRole === "admin" ? "info" : "neutral"}
            dot={false}
          >
            {step.accountRole === "admin" ? "管理员" : "成员"}
          </StatusBadge>
          <span className="text-xs text-muted-foreground tabular-nums">
            +{formatDelay(step.delaySeconds)}
          </span>
          <span className="min-w-0 flex-1 break-words whitespace-normal">
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SequenceListView({
  rows,
  loading,
  error,
  retrying,
  onRetry,
  canWrite,
  onCreate,
  onStart,
  createDialog,
  startDialog,
}: SequenceListViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const columns = useMemo(() => {
    const toggle = (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);

        if (next.has(id)) next.delete(id);
        else next.add(id);

        return next;
      });

    return buildColumns(expanded, toggle, canWrite, onStart);
  }, [canWrite, expanded, onStart]);

  return (
    <>
      <PageHeader
        title="定时序列"
        description="按步骤与延迟依次发言的消息模板。每步由管理员或成员账号发出，文本里的 {占位符} 在启动时取值、先预检再发。"
        actions={
          <>
            <Button variant="outline" onClick={onRetry} disabled={retrying}>
              <RefreshCw className={cn({ "animate-spin": retrying })} />
              刷新
            </Button>
            {createDialog ? (
              <Button onClick={onCreate}>
                <Plus />
                新建序列
              </Button>
            ) : null}
          </>
        }
      />

      {createDialog ? <CreateSequenceDialogView {...createDialog} /> : null}
      <StartSequenceDialogView {...startDialog} />

      {error ? (
        <QueryError
          title="序列列表加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={rows}
              getRowId={(row) => row.id}
              loading={loading}
              emptyTitle="还没有序列"
              emptyDescription={
                canWrite
                  ? "点右上角「新建序列」，定义每一步由谁发、发什么、等多久。"
                  : "管理员新建序列后会出现在这里。"
              }
              renderSubRow={(row) =>
                expanded.has(row.id) ? (
                  <StepList sequence={row.sequence} />
                ) : null
              }
              testId="sequence-table"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

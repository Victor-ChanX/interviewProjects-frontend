// 步骤表：DataTable（# / 类型 / 工具名 / 入参 / 结果摘要 / 审计结论 / 错误码）。每行可展开看完整入参 JSON；
// 协议错误步展开后还有 Agent 服务返回的原始响应体（后端截到 2KB）。展开集合是轻量纯视觉 state，留在 view。

import { ChevronRight, FileCode } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import {
  AGENT_STEP_KIND_LABELS,
  AGENT_STEP_KIND_TONE,
  AUDIT_VERDICT_CLASS,
  AUDIT_VERDICT_LABELS,
} from "@/lib/agent-run-labels";
import { cn } from "@/lib/utils";
import type { AgentStepRead } from "@/services/agent-run-service";

import { formatJson, summarizeJson } from "./step-json";
import type { AgentStepTableViewProps } from "./types";

const col = dataTableColumnHelper<AgentStepRead>();

const Dash = () => <span className="text-muted-foreground">-</span>;

function hasDetail(step: AgentStepRead): boolean {
  return step.input !== null || step.rawResponse !== null;
}

function buildColumns(
  expanded: ReadonlySet<number>,
  toggle: (index: number) => void,
) {
  return col.columns([
    col.display({
      id: "expand",
      header: () => <span className="sr-only">展开</span>,
      meta: { className: "w-8 pr-0" },
      cell: ({ row }) =>
        hasDetail(row.original) ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={expanded.has(row.original.index) ? "收起" : "展开"}
            aria-expanded={expanded.has(row.original.index)}
            onClick={() => toggle(row.original.index)}
          >
            <ChevronRight
              className={cn("transition-transform", {
                "rotate-90": expanded.has(row.original.index),
              })}
            />
          </Button>
        ) : null,
    }),
    col.accessor("index", {
      header: "#",
      meta: { className: "w-10 tabular-nums" },
    }),
    col.accessor("kind", {
      header: "类型",
      meta: { label: "类型", className: "w-24" },
      cell: ({ row }) => (
        <StatusBadge tone={AGENT_STEP_KIND_TONE[row.original.kind]} dot={false}>
          {AGENT_STEP_KIND_LABELS[row.original.kind]}
        </StatusBadge>
      ),
    }),
    col.accessor("name", {
      header: "工具名",
      meta: { label: "工具名", className: "w-44" },
      cell: ({ row }) =>
        row.original.name ? (
          <span className="font-mono text-xs">{row.original.name}</span>
        ) : (
          <Dash />
        ),
    }),
    col.accessor("input", {
      header: "入参",
      meta: { label: "入参", className: "max-w-60" },
      cell: ({ row }) =>
        row.original.input ? (
          <span
            className="block truncate font-mono text-xs text-muted-foreground"
            title={summarizeJson(row.original.input, 400)}
          >
            {summarizeJson(row.original.input)}
          </span>
        ) : (
          <Dash />
        ),
    }),
    col.accessor("resultSummary", {
      header: "结果摘要",
      meta: { label: "结果摘要", className: "max-w-72 whitespace-normal" },
      cell: ({ row }) =>
        row.original.resultSummary ? (
          <span
            className="line-clamp-2 break-words"
            title={row.original.resultSummary}
          >
            {row.original.resultSummary}
          </span>
        ) : (
          <Dash />
        ),
    }),
    col.accessor("auditVerdict", {
      header: "审计结论",
      meta: { label: "审计结论", className: "w-28" },
      cell: ({ row }) => {
        const step = row.original;

        if (step.auditVerdict)
          return (
            <span
              className={cn(
                "font-medium",
                AUDIT_VERDICT_CLASS[step.auditVerdict],
              )}
            >
              {AUDIT_VERDICT_LABELS[step.auditVerdict]}
              {step.auditAttempts > 1 ? `（${step.auditAttempts} 次）` : null}
            </span>
          );

        return step.auditAttempts > 0 ? (
          <span className="text-destructive">
            无结论（{step.auditAttempts} 次）
          </span>
        ) : (
          <Dash />
        );
      },
    }),
    col.accessor("errorCode", {
      header: "错误码",
      meta: { label: "错误码", className: "w-36" },
      cell: ({ row }) =>
        row.original.errorCode ? (
          <span className="font-mono text-xs text-destructive">
            {row.original.errorCode}
          </span>
        ) : (
          <Dash />
        ),
    }),
    col.display({
      id: "raw",
      header: () => <span className="sr-only">原始响应</span>,
      meta: { className: "w-32 text-right" },
      cell: ({ row }) =>
        row.original.kind === "protocol_error" ? (
          <Button
            variant="outline"
            size="xs"
            onClick={() => toggle(row.original.index)}
          >
            <FileCode />
            {expanded.has(row.original.index) ? "收起原始响应" : "查看原始响应"}
          </Button>
        ) : null,
    }),
  ]);
}

function StepDetail({ step }: { step: AgentStepRead }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {step.input !== null ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            入参（完整 JSON）
          </span>
          <pre className="max-h-64 overflow-auto rounded-lg bg-card p-3 font-mono text-xs whitespace-pre-wrap break-all ring-1 ring-border">
            {formatJson(step.input)}
          </pre>
        </div>
      ) : null}
      {step.rawResponse !== null ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium text-destructive">
            原始响应体{step.errorCode ? `（${step.errorCode}）` : null}：Agent
            服务返回的原文，超过 2KB 的部分已被截断
          </span>
          <pre
            className="max-h-64 overflow-auto rounded-lg bg-card p-3 font-mono text-xs whitespace-pre-wrap break-all ring-1 ring-destructive/30"
            data-testid="raw-response"
          >
            {step.rawResponse}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function AgentStepTableView({ steps }: AgentStepTableViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const columns = useMemo(() => {
    const toggle = (index: number) =>
      setExpanded((prev) => {
        const next = new Set(prev);

        if (next.has(index)) next.delete(index);
        else next.add(index);

        return next;
      });

    return buildColumns(expanded, toggle);
  }, [expanded]);

  return (
    <DataTable
      columns={columns}
      data={steps}
      getRowId={(step) => String(step.index)}
      emptyTitle="还没有步骤"
      emptyDescription="运行开始后，每一轮工具调用都会出现在这里。"
      rowClassName={(step) =>
        step.isError ? "bg-destructive/5 hover:bg-destructive/10" : undefined
      }
      renderSubRow={(step) =>
        expanded.has(step.index) ? <StepDetail step={step} /> : null
      }
      testId="agent-step-table"
    />
  );
}

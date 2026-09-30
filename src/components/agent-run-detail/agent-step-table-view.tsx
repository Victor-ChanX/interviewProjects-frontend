// 步骤表：纯展示。index / kind / 工具名 / 入参（JSON 摘要，可展开）/ 结果摘要 / 审计结论 / 错误码；
// 协议错误步多一个「查看原始响应」按钮（浮层由父层管）。展开集合是轻量纯视觉 state，留在 view。
// 原生 <table>：共享 DataTable 尚未落地（与 group-detail 的 run 列表同口径）。

import { ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AGENT_STEP_KIND_LABELS,
  AUDIT_VERDICT_CLASS,
  AUDIT_VERDICT_LABELS,
} from "@/lib/agent-run-labels";
import { cn } from "@/lib/utils";
import type { AgentStepKind } from "@/services/agent-run-service";

import { formatJson, summarizeJson } from "./step-json";
import type { AgentStepTableViewProps } from "./types";

/** kind → 徽标样式，走主题 token；协议错误步醒目。 */
const KIND_CLASS: Readonly<Record<AgentStepKind, string>> = {
  tool_use: "border-border bg-muted text-foreground",
  final: "border-success/40 bg-success/15 text-success",
  protocol_error: "border-destructive/40 bg-destructive/15 text-destructive",
};

const HEADERS = [
  "#",
  "kind",
  "工具名",
  "入参",
  "结果摘要",
  "审计结论",
  "错误码",
  "",
] as const;

const Dash = () => <span className="text-muted-foreground">-</span>;

export function AgentStepTableView({
  steps,
  onViewRawResponse,
}: AgentStepTableViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  if (steps.length === 0)
    return <p className="text-sm text-muted-foreground">还没有步骤</p>;

  const toggle = (index: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(index)) next.delete(index);
      else next.add(index);

      return next;
    });

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm" data-testid="agent-step-table">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {HEADERS.map((header, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {steps.map((step) => {
            const isOpen = expanded.has(step.index);
            const hasInput = step.input !== null;

            return (
              <tr
                key={step.index}
                className={cn("align-top", {
                  "bg-destructive/5": step.isError,
                })}
              >
                <td className="px-3 py-2 tabular-nums">{step.index}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", KIND_CLASS[step.kind])}
                  >
                    {AGENT_STEP_KIND_LABELS[step.kind]}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {step.name ?? <Dash />}
                </td>
                <td className="max-w-md px-3 py-2">
                  {hasInput ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="flex items-start gap-1 text-left font-mono text-xs hover:underline"
                        aria-expanded={isOpen}
                        onClick={() => toggle(step.index)}
                      >
                        {isOpen ? (
                          <ChevronDown className="mt-0.5 size-3 shrink-0" />
                        ) : (
                          <ChevronRight className="mt-0.5 size-3 shrink-0" />
                        )}
                        <span className="break-all">
                          {isOpen ? "收起" : summarizeJson(step.input)}
                        </span>
                      </button>
                      {isOpen ? (
                        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap break-all">
                          {formatJson(step.input)}
                        </pre>
                      ) : null}
                    </div>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td
                  className="max-w-xs px-3 py-2"
                  title={step.resultSummary ?? undefined}
                >
                  {step.resultSummary ? (
                    <span className="line-clamp-3 break-words">
                      {step.resultSummary}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="px-3 py-2">
                  {step.auditVerdict ? (
                    <span
                      className={cn(
                        "font-medium",
                        AUDIT_VERDICT_CLASS[step.auditVerdict],
                      )}
                    >
                      {AUDIT_VERDICT_LABELS[step.auditVerdict]}
                      {step.auditAttempts > 1
                        ? `（${step.auditAttempts} 次）`
                        : null}
                    </span>
                  ) : step.auditAttempts > 0 ? (
                    <span className="text-muted-foreground">
                      无结论（{step.auditAttempts} 次）
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {step.errorCode ? (
                    <span className="text-destructive">{step.errorCode}</span>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className="px-3 py-2">
                  {step.kind === "protocol_error" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewRawResponse(step)}
                    >
                      <FileCode className="size-3.5" />
                      查看原始响应
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

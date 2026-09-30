// Agent run 的枚举 → 中文文案 / 徽标样式（题目 2.3 agent-runs）。群详情的 run 列表与 run 详情页共用
// （frontend-component-splitting split.promote-shared：被 2+ feature 用到就提升）。样式全部走主题 token。

import type {
  AgentRunEndReason,
  AgentRunStatus,
  AgentStepKind,
  AuditVerdict,
} from "@/services/agent-run-service";

export const AGENT_RUN_STATUS_LABELS: Readonly<Record<AgentRunStatus, string>> =
  {
    running: "运行中",
    finished: "已完成",
    failed: "失败",
    blocked: "已拦截",
    cancelled: "已取消",
  };

/** 状态 → 徽标样式；blocked（审计拦下）比 failed 更醒目。 */
export const AGENT_RUN_STATUS_CLASS: Readonly<Record<AgentRunStatus, string>> =
  {
    running: "border-warning/40 bg-warning/15 text-warning",
    finished: "border-success/40 bg-success/15 text-success",
    failed: "border-destructive/40 bg-destructive/15 text-destructive",
    blocked:
      "border-destructive bg-destructive/25 font-semibold text-destructive",
    cancelled: "border-border bg-muted text-muted-foreground",
  };

export const AGENT_RUN_END_REASON_LABELS: Readonly<
  Record<AgentRunEndReason, string>
> = {
  final: "正常结束",
  budget_exhausted: "预算耗尽",
  wall_clock: "超时",
  protocol_errors: "协议错误过多",
  audit_blocked: "审计拦截",
  cancelled: "被取消",
};

export const AGENT_STEP_KIND_LABELS: Readonly<Record<AgentStepKind, string>> = {
  tool_use: "工具调用",
  final: "结束",
  protocol_error: "协议错误",
};

export const AUDIT_VERDICT_LABELS: Readonly<Record<AuditVerdict, string>> = {
  pass: "通过",
  fail: "拒绝",
};

/** 审计结论 → 文字色；null（未审计 / 拿不到结论）由调用方另渲染。 */
export const AUDIT_VERDICT_CLASS: Readonly<Record<AuditVerdict, string>> = {
  pass: "text-success",
  fail: "text-destructive",
};

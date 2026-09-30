// Agent run 的枚举 → 中文文案 / 徽标语气（题目 2.3 agent-runs）。群详情的 run 页签、全局 Agent 运行列表、
// run 详情页、工作台共用（frontend-component-splitting split.promote-shared）。样式按语气取（src/lib/status-tone.ts）。
// 文案与后端仓 docs/manual-testing.md 一致：blocked 是「被拦下」。

import type { StatusTone } from "@/lib/status-tone";
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
    blocked: "被拦下",
    cancelled: "已取消",
  };

/** 状态 → 徽标语气；blocked（审计拦下）与 failed 一样是 danger，行本身再整行高亮。 */
export const AGENT_RUN_STATUS_TONE: Readonly<
  Record<AgentRunStatus, StatusTone>
> = {
  running: "info",
  finished: "success",
  failed: "danger",
  blocked: "danger",
  cancelled: "muted",
};

/** 全局列表的状态筛选页签（顺序即页签顺序；all = 不带 status 参数）。 */
export const AGENT_RUN_STATUS_FILTERS: readonly ("all" | AgentRunStatus)[] =
  Object.freeze([
    "all",
    "running",
    "blocked",
    "failed",
    "finished",
    "cancelled",
  ]);

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

export const AGENT_STEP_KIND_TONE: Readonly<Record<AgentStepKind, StatusTone>> =
  {
    tool_use: "neutral",
    final: "success",
    protocol_error: "danger",
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

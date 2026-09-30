// 异步任务（建群 / 全部退群）的枚举与步骤 → 中文文案。群列表的新建群弹窗与群详情的全部退群弹窗共用
// （frontend-component-splitting split.promote-shared：被 2+ feature 用到就提升），进度原子
// src/components/ui-atoms/job-progress.tsx 用它渲染。样式全部走主题 token。

import type { JobKind, JobStatus, JobStepKind } from "@/services/job-service";

export const JOB_KIND_LABELS: Readonly<Record<JobKind, string>> = {
  create_group: "建群",
  leave_all: "全部退群",
};

export const JOB_STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  running: "进行中",
  finished: "已完成",
  failed: "失败",
};

export const JOB_STATUS_CLASS: Readonly<Record<JobStatus, string>> = {
  running: "border-warning/40 bg-warning/15 text-warning",
  finished: "border-success/40 bg-success/15 text-success",
  failed: "border-destructive/40 bg-destructive/15 text-destructive",
};

export const JOB_STEP_KIND_LABELS: Readonly<Record<JobStepKind, string>> = {
  create: "在网关建群",
  invite: "申请邀请链接",
  join: "入群",
  promote: "提升管理员",
  leave: "退群",
};

/**
 * job_errors.code → 中文说明。本地码见后端 src/services/group-job-service.ts 的 JOB_ERROR_CODES，
 * 其余是网关的码原样记下（模拟器 src/sim/gateway/README.md 的端点表）。不在表里的码原样显示。
 */
const JOB_ERROR_CODE_LABELS: Readonly<Record<string, string>> = {
  JOIN_TIMEOUT: "入群超时：10 秒内没等到入群事件",
  INVITE_EXPIRED: "邀请链接已过期（重新申请后仍过期）",
  INVITE_NOT_READY: "邀请链接尚未生效",
  ALREADY_MEMBER: "账号已在群里",
  NOT_MEMBER_YET: "成员还没入群，无法提升为管理员",
  NO_PERMISSION: "没有权限",
  ACCOUNT_OFFLINE: "账号离线",
  ACCOUNT_NOT_CONNECTED: "账号已不在线（没有平台身份）",
  NOT_IN_GROUP: "账号不在群里",
  GATEWAY_UNAVAILABLE: "网关连续不可用",
  PROMOTE_RESULT_UNKNOWN: "提升管理员的结果未知",
  INTERNAL: "网关或服务内部错误",
};

/** 已知码返回中文说明，未知码返回 null（调用方原样显示 code）。 */
export function describeJobErrorCode(code: string): string | null {
  return Object.hasOwn(JOB_ERROR_CODE_LABELS, code)
    ? JOB_ERROR_CODE_LABELS[code]
    : null;
}

function isStepKind(value: string): value is JobStepKind {
  return Object.hasOwn(JOB_STEP_KIND_LABELS, value);
}

/**
 * job.step 的展示文案：`create` / `invite` / `promote`，或按账号的 `join:<accountId>` / `leave:<accountId>`
 * （后端 GET /api/jobs/:jobId 与 WS job 事件同一种拼法）。未知的步骤原样返回。
 */
export function describeJobStep(step: string): string {
  const colon = step.indexOf(":");
  const kind = colon === -1 ? step : step.slice(0, colon);

  if (!isStepKind(kind)) return step;

  const label = JOB_STEP_KIND_LABELS[kind];

  if (colon === -1) return label;

  return `账号 ${step.slice(colon + 1)} ${label}`;
}

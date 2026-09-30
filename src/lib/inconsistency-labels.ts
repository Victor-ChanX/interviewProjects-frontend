// 不一致记录的 kind → 中文名。kind 在后端是自由字符串（openapi 里是 string，没有枚举，派生不了），
// 已知的几种来自后端 src/services/inbound-service.ts 的 INCONSISTENCY_KINDS 与
// src/services/group-job-service.ts 的 LEAVE_ALL_INCONSISTENCY_KINDS；不认识的原样显示。

const INCONSISTENCY_KIND_LABELS: Readonly<Record<string, string>> = {
  inbound_unknown_group: "未知群",
  inbound_event_failed: "入站事件处理失败",
  leave_all_members_mismatch: "退群对账不一致",
  leave_all_reconcile_unavailable: "退群对账未完成",
};

export function describeInconsistencyKind(kind: string): string {
  return Object.hasOwn(INCONSISTENCY_KIND_LABELS, kind)
    ? INCONSISTENCY_KIND_LABELS[kind]
    : kind;
}

/** 异常中心的两个页签（GET /api/inconsistencies?resolved=）。 */
export type InconsistencyTab = "open" | "resolved";

export const INCONSISTENCY_TAB_LABELS: Readonly<
  Record<InconsistencyTab, string>
> = {
  open: "未处理",
  resolved: "已处理",
};

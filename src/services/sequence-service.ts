// 序列端点 wrapper（题目 2.3 `GET/POST /api/sequences`、`POST /api/groups/:id/sequence-runs`、
// `GET /api/sequence-runs/:id`；前端 #6）。URL、方法、请求体都在这里（api.wrapper-owns-url）；
// 类型从 api.generated 派生（api.types-derived）。
//
// 启动的两种业务拒绝由 RequestError 的 code 分流（不比对文案）：
// - 422 UNRESOLVED_PLACEHOLDER：信封里多带 { stepIndex, key }（请求层把整个 error 信封放进 RequestError.detail），
//   getUnresolvedPlaceholder() 把它们取出来给表单高亮。
// - 409 SEQUENCE_ALREADY_RUNNING：isSequenceAlreadyRunning()。

import { api, RequestError } from "@/lib/api";
import { groupUrl } from "@/services/group-service";
import type { components, paths } from "@/types/api.generated";

export type SequenceRead = components["schemas"]["SequenceRead"];

export type SequenceList = components["schemas"]["SequenceList"];

export type SequenceStepDefinition =
  components["schemas"]["SequenceStepDefinition"];

export type SequenceAccountRole = components["schemas"]["SequenceAccountRole"];

/** `POST /api/sequences` 的请求体（题目 B1 的序列 JSON）。 */
export type SequenceDefinitionPayload =
  paths["/api/sequences"]["post"]["requestBody"]["content"]["application/json"];

export type SequenceCreated = components["schemas"]["SequenceCreated"];

/** `POST /api/groups/:id/sequence-runs` 的请求体：{ sequenceId, vars, stepVars }。 */
export type StartSequenceRunPayload =
  paths["/api/groups/{id}/sequence-runs"]["post"]["requestBody"]["content"]["application/json"];

export type SequenceRunStarted = components["schemas"]["SequenceRunStarted"];

export type SequenceRunRead = components["schemas"]["SequenceRunRead"];

export type SequenceRunStepRead = components["schemas"]["SequenceRunStepRead"];

export type SequenceRunStatus = components["schemas"]["SequenceRunStatus"];

export type SequenceStepStatus = components["schemas"]["SequenceStepStatus"];

/**
 * WS `sequence_run` 事件（题目 2.3：{ runId, groupId, status, currentStepIndex }）。WS 帧不在 openapi 里，
 * 派生不了，手写；字段类型仍取自生成的 schema。放这里而不是 src/lib/ws.ts：事件只有序列这一域消费，
 * 且 payload 的形状跟着 SequenceRunRead 走。
 */
export type SequenceRunEventPayload = {
  runId: string;
  groupId: string;
  status: SequenceRunStatus;
  currentStepIndex: number;
};

export const UNRESOLVED_PLACEHOLDER_CODE = "UNRESOLVED_PLACEHOLDER";

export const SEQUENCE_ALREADY_RUNNING_CODE = "SEQUENCE_ALREADY_RUNNING";

const SEQUENCES_URL = "/api/sequences";

const SEQUENCE_RUNS_URL = "/api/sequence-runs";

// /api/groups 这个前缀的 owner 是 group-service（duplicate-endpoint-literal），这里只拼子路径。
export function groupSequenceRunsUrl(groupId: string): string {
  return `${groupUrl(groupId)}/sequence-runs`;
}

export function sequenceRunUrl(id: string): string {
  return `${SEQUENCE_RUNS_URL}/${encodeURIComponent(id)}`;
}

/** 前端消费的列表负载：{ items, total } 直接透传（序列天然不多，不分页）。 */
export function listSequences(): Promise<SequenceList> {
  return api.get<SequenceList>(SEQUENCES_URL);
}

export function createSequence(
  definition: SequenceDefinitionPayload,
): Promise<SequenceCreated> {
  return api.post<SequenceCreated>(SEQUENCES_URL, definition);
}

export function startSequenceRun(
  groupId: string,
  payload: StartSequenceRunPayload,
): Promise<SequenceRunStarted> {
  return api.post<SequenceRunStarted>(groupSequenceRunsUrl(groupId), payload);
}

export function getSequenceRun(id: string): Promise<SequenceRunRead> {
  return api.get<SequenceRunRead>(sequenceRunUrl(id));
}

/** 后端预检不通过时信封里的定位：第几步、哪个 key。 */
export interface UnresolvedPlaceholder {
  stepIndex: number;
  key: string;
}

/**
 * 422 UNRESOLVED_PLACEHOLDER → { stepIndex, key }；其它错误（含信封缺字段的 422）→ null。
 * 信封字段缺失时不猜：返回 null，调用方按普通错误 toast。
 */
export function getUnresolvedPlaceholder(
  error: unknown,
): UnresolvedPlaceholder | null {
  if (!(error instanceof RequestError)) return null;

  if (error.status !== 422 || error.code !== UNRESOLVED_PLACEHOLDER_CODE)
    return null;

  const detail = error.detail;

  if (!detail || typeof detail !== "object") return null;

  const { stepIndex, key } = detail as { stepIndex?: unknown; key?: unknown };

  if (typeof stepIndex !== "number" || typeof key !== "string" || !key)
    return null;

  return { stepIndex, key };
}

export function isSequenceAlreadyRunning(error: unknown): boolean {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === SEQUENCE_ALREADY_RUNNING_CODE
  );
}

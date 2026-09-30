// 异步任务端点 wrapper（`GET /api/jobs/:jobId`；前端 #10）：建群与全部退群都是 202 { jobId }，
// 进度与失败步骤从这里查。URL 在这里（api.wrapper-owns-url），类型从 api.generated 派生（api.types-derived）。
// 两个 feature（群列表的新建群、群详情的全部退群）共用，所以放 src/services 而不是某个 feature 里。

import { api } from "@/lib/api";
import type { components } from "@/types/api.generated";

export type JobRead = components["schemas"]["JobRead"];

export type JobStatus = components["schemas"]["JobStatus"];

export type JobKind = components["schemas"]["JobKind"];

export type JobErrorRead = components["schemas"]["JobErrorRead"];

export type JobStepKind = components["schemas"]["JobStepKind"];

/**
 * WS `job` 事件（后端 src/services/ws-events.ts：建群 / leave-all 每步推进与终态推一次）。
 * WS 帧不在 openapi 里，派生不了，手写；字段类型仍取自生成的 schema。事件不带 errors[]，
 * 所以收到后按 jobId 重拉 GET /api/jobs/:jobId，不就地打补丁。
 */
export type JobEventPayload = {
  jobId: string;
  groupId: string | null;
  kind: JobKind;
  status: JobStatus;
  /** create / invite / promote，或 join:<accountId> / leave:<accountId>。 */
  step: string | null;
};

const JOBS_URL = "/api/jobs";

export function jobUrl(id: string): string {
  return `${JOBS_URL}/${encodeURIComponent(id)}`;
}

export function getJob(id: string): Promise<JobRead> {
  return api.get<JobRead>(jobUrl(id));
}

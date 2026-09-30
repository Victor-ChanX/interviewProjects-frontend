// 群端点 wrapper（题目 2.3 `GET /api/groups`、`GET /api/groups/:id`、`PATCH /api/groups/:id`；
// 前端 #10：`POST /api/groups` 建群、`POST /api/groups/:id/leave-all` 全部退群，两者都是 202 { jobId }，
// 进度走 src/services/job-service.ts + src/hooks/use-job-progress.ts）。
// URL、方法、请求体都在这里（api.wrapper-owns-url）；类型从 api.generated 派生（api.types-derived）。
// 列表是裸数组（GroupList = GroupRead[]），不是 { items } 包裹，所以不需要 normalize。
// 建群 / 退群的拒绝（422 ACCOUNT_NOT_ONLINE、400 VALIDATION_ERROR、409 GROUP_ALREADY_LEFT / GROUP_NOT_READY /
// JOB_ALREADY_RUNNING）只需要展示后端的整句 message，由调用方 getErrorMessage 取，这里不分流错误码。

import { api } from "@/lib/api";
import type { components, paths } from "@/types/api.generated";

export type GroupRead = components["schemas"]["GroupRead"];

export type GroupMemberRead = components["schemas"]["GroupMemberRead"];

export type GroupStatus = components["schemas"]["GroupStatus"];

export type MemberRole = components["schemas"]["MemberRole"];

/** PATCH 的请求体：两个开关都可选，只发要改的那个。 */
export type PatchGroupPayload =
  paths["/api/groups/{id}"]["patch"]["requestBody"]["content"]["application/json"];

/** `POST /api/groups` 的请求体：{ creatorAccountId, memberAccountIds }（memberAccountIds[0] 会被提升为管理员）。 */
export type CreateGroupPayload =
  paths["/api/groups"]["post"]["requestBody"]["content"]["application/json"];

export type CreateGroupResponse = components["schemas"]["CreateGroupResponse"];

export type LeaveAllResponse = components["schemas"]["LeaveAllResponse"];

const GROUPS_URL = "/api/groups";

export function groupUrl(id: string): string {
  return `${GROUPS_URL}/${encodeURIComponent(id)}`;
}

export function listGroups(): Promise<GroupRead[]> {
  return api.get<GroupRead[]>(GROUPS_URL);
}

export function getGroup(id: string): Promise<GroupRead> {
  return api.get<GroupRead>(groupUrl(id));
}

export function patchGroup(
  id: string,
  patch: PatchGroupPayload,
): Promise<GroupRead> {
  return api.patch<GroupRead>(groupUrl(id), patch);
}

/** 建群 + 拉人 + 提升第一个成员为管理员（异步 job）：202 { jobId }。 */
export function createGroup(
  payload: CreateGroupPayload,
): Promise<CreateGroupResponse> {
  return api.post<CreateGroupResponse>(GROUPS_URL, payload);
}

/** 群里所有服务账号退群（非群主先、群主最后；异步 job）：202 { jobId }。 */
export function leaveAllGroup(id: string): Promise<LeaveAllResponse> {
  return api.post<LeaveAllResponse>(`${groupUrl(id)}/leave-all`);
}

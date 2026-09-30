// 群端点 wrapper（题目 2.3 `GET /api/groups`、`GET /api/groups/:id`、`PATCH /api/groups/:id`）。
// URL、方法、请求体都在这里（api.wrapper-owns-url）；类型从 api.generated 派生（api.types-derived）。
// 列表是裸数组（GroupList = GroupRead[]），不是 { items } 包裹，所以不需要 normalize。

import { api } from "@/lib/api";
import type { components, paths } from "@/types/api.generated";

export type GroupRead = components["schemas"]["GroupRead"];

export type GroupMemberRead = components["schemas"]["GroupMemberRead"];

export type GroupStatus = components["schemas"]["GroupStatus"];

export type MemberRole = components["schemas"]["MemberRole"];

/** PATCH 的请求体：两个开关都可选，只发要改的那个。 */
export type PatchGroupPayload =
  paths["/api/groups/{id}"]["patch"]["requestBody"]["content"]["application/json"];

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

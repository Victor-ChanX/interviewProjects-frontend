// 异常中心端点 wrapper（后端 #22：`GET /api/inconsistencies?resolved=&before=&limit=`、`GET /api/inconsistencies/:id`、
// `POST /api/inconsistencies/:id/resolve`；前端 #12）。URL、方法、query 都在这里（api.wrapper-owns-url），
// 类型从 api.generated 派生（api.types-derived）。列表不含 payload，详情才有（Sheet 里展示）。
// resolve 幂等：重复标记返回原记录（含 resolvedBy），只有 admin 能调（viewer 403）。

import { api } from "@/lib/api";
import type { InconsistencyTab } from "@/lib/inconsistency-labels";
import type { components } from "@/types/api.generated";

export type InconsistencyRead = components["schemas"]["InconsistencyRead"];

export type InconsistencyDetail = components["schemas"]["InconsistencyDetail"];

export type InconsistencyPage = components["schemas"]["InconsistencyPage"];

export interface ListInconsistenciesParams {
  tab: InconsistencyTab;
  before?: string;
  limit: number;
}

const INCONSISTENCIES_URL = "/api/inconsistencies";

export function inconsistencyUrl(id: string): string {
  return `${INCONSISTENCIES_URL}/${encodeURIComponent(id)}`;
}

/** 页签 → resolved 参数：未处理 = "false"、已处理 = "true"（后端按字符串枚举收）。 */
export function resolvedParam(
  tab: InconsistencyTab,
): components["schemas"]["InconsistencyResolvedFilterInput"] {
  return tab === "resolved" ? "true" : "false";
}

export function listInconsistencies(
  params: ListInconsistenciesParams,
): Promise<InconsistencyPage> {
  return api.get<InconsistencyPage>(INCONSISTENCIES_URL, {
    query: {
      resolved: resolvedParam(params.tab),
      before: params.before,
      limit: params.limit,
    },
  });
}

export function getInconsistency(id: string): Promise<InconsistencyDetail> {
  return api.get<InconsistencyDetail>(inconsistencyUrl(id));
}

export function resolveInconsistency(id: string): Promise<InconsistencyRead> {
  return api.post<InconsistencyRead>(`${inconsistencyUrl(id)}/resolve`);
}

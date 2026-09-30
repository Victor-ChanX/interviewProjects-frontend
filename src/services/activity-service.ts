// 最近动态端点 wrapper（后端 #22：`GET /api/activity?before=&limit=`；前端 #12）。URL 与 query 在这里
// （api.wrapper-owns-url），类型从 api.generated 派生（api.types-derived）。
// 动态就是 WS 事件表的只读视图：按 seq 倒序游标分页，帧与 WS 推送同形 { seq, type, payload }（多一个 createdAt），
// 所以首屏用它、之后把 WS 事件接在最前面（src/lib/activity-cache.ts）。

import { api } from "@/lib/api";
import type { components } from "@/types/api.generated";

export type ActivityPage = components["schemas"]["ActivityPage"];

export type ActivityItem = components["schemas"]["ActivityItem"];

export type ActivityEventType = components["schemas"]["ActivityEventType"];

export interface ListActivityParams {
  /** 上一页的 nextCursor；不传 = 从最新一条开始。 */
  before?: string;
  limit: number;
}

const ACTIVITY_URL = "/api/activity";

export function listActivity(
  params: ListActivityParams,
): Promise<ActivityPage> {
  return api.get<ActivityPage>(ACTIVITY_URL, {
    query: { before: params.before, limit: params.limit },
  });
}

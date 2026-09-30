// 实时动态的缓存拼接（frontend-realtime-events「列表：游标分页 + 实时追加」）：首屏是 GET /api/activity 的
// useInfiniteQuery（InfiniteData<ActivityPage>，pages[0] 最新），之后 WS 事件只插进 pages[0] 的头部，
// pageParams 与旧页不动（游标是「seq 比某项小」，后来的新事件不影响旧游标），按 seq 去重。
// 工作台只要一页，给 maxHead 截掉最旧的，最多留那么多条；实时动态页不截（「加载更早」接在最后一页）。

import type { InfiniteData } from "@tanstack/react-query";

import { ACTIVITY_EVENT_TYPES, type RealtimeEvent } from "@/lib/ws";
import type { ActivityItem, ActivityPage } from "@/services/activity-service";

export type ActivityData = InfiniteData<ActivityPage>;

function isActivityType(type: string): type is ActivityItem["type"] {
  return (ACTIVITY_EVENT_TYPES as readonly string[]).includes(type);
}

/** WS 事件 → 一条动态；不进动态流的类型（操作回执）或 payload 不是对象的返回 null。createdAt 用收到的时刻。 */
export function eventToActivity(
  event: RealtimeEvent,
  receivedAt: string,
): ActivityItem | null {
  if (!isActivityType(event.type)) return null;

  const { payload } = event;

  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;

  return {
    seq: event.seq,
    type: event.type,
    payload: payload as Record<string, unknown>,
    createdAt: receivedAt,
  };
}

function hasSeq(data: ActivityData, seq: number): boolean {
  return data.pages.some((page) => page.items.some((item) => item.seq === seq));
}

/** 按 seq 倒序插进最新页；已有同 seq 原样返回。maxHead：插完后最新页最多留几条。 */
export function prependActivity(
  data: ActivityData,
  item: ActivityItem,
  maxHead?: number,
): ActivityData {
  const head = data.pages[0];

  if (!head || hasSeq(data, item.seq)) return data;

  const at = head.items.findIndex((existing) => existing.seq < item.seq);
  const items =
    at === -1
      ? [...head.items, item]
      : [...head.items.slice(0, at), item, ...head.items.slice(at)];

  return {
    ...data,
    pages: [
      {
        ...head,
        items: maxHead === undefined ? items : items.slice(0, maxHead),
      },
      ...data.pages.slice(1),
    ],
  };
}

/** 全部已加载的动态（seq 倒序）。 */
export function flattenActivity(
  data: ActivityData | undefined,
): ActivityItem[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

// 实时事件的订阅入口：container 用它，view 不知道有连接存在。
// 事件进入 TanStack Query 缓存的唯一途径是 queryClient.setQueryData / invalidateQueries，
// key 一律取自 @/lib/query-keys。组件卸载只退订，连接是应用级单例，不在这里 close。

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { queryKeys } from "@/lib/query-keys";
import {
  getConnectionStatus,
  subscribeConnectionStatus,
  subscribeRealtime,
  type RealtimeEvent,
} from "@/lib/ws";
import type {
  ExampleListPayload,
  ExampleRead,
} from "@/services/example-service";

export type ExampleEvent =
  | (RealtimeEvent<ExampleRead> & { type: "example.created" })
  | (RealtimeEvent<ExampleRead> & { type: "example.updated" })
  | (RealtimeEvent<{ id: number }> & { type: "example.deleted" });

function isExampleEvent(event: RealtimeEvent): event is ExampleEvent {
  return event.type.startsWith("example.");
}

/**
 * 订阅 example 域的实时事件并回写缓存。
 * 「实时追加」与「加载更早」（游标分页）并存：新事件只插到最新页（无 cursor 的那页）头部，
 * 旧页的游标不变，不重不漏；更新 / 删除按 id 就地改；其余情况按域前缀 invalidate。
 */
export function useRealtimeExamples(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (!isExampleEvent(event)) return;

      const firstPageKey = queryKeys.examples.list({});

      switch (event.type) {
        case "example.created":
          queryClient.setQueryData<ExampleListPayload>(firstPageKey, (prev) =>
            prev && !prev.items.some((item) => item.id === event.payload.id)
              ? { ...prev, items: [event.payload, ...prev.items] }
              : prev,
          );
          break;
        case "example.updated":
          queryClient.setQueryData<ExampleListPayload>(firstPageKey, (prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((item) =>
                    item.id === event.payload.id ? event.payload : item,
                  ),
                }
              : prev,
          );
          queryClient.setQueryData<ExampleRead>(
            queryKeys.examples.detail(event.payload.id),
            event.payload,
          );
          break;
        case "example.deleted":
          void queryClient.invalidateQueries({
            queryKey: queryKeys.examples.all,
          });
          break;
      }
    });
  }, [queryClient]);
}

/** 连接状态（给 container 决定要不要显示「离线」角标）。 */
export function useRealtimeStatus() {
  return useSyncExternalStore(
    subscribeConnectionStatus,
    getConnectionStatus,
    () => "idle" as const,
  );
}

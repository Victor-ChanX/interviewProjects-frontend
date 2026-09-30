// 实时事件的订阅入口：container / feature hook 用它，view 不知道有连接存在。
// 事件进入 TanStack Query 缓存的唯一途径是 queryClient.setQueryData / invalidateQueries，
// key 一律取自 @/lib/query-keys。组件卸载只退订，连接是应用级单例，不在这里 close。

import { useEffect, useSyncExternalStore } from "react";

import { useSession } from "@/hooks/use-session";
import {
  connectRealtime,
  disconnectRealtime,
  getConnectionStatus,
  subscribeConnectionStatus,
  subscribeRealtime,
  type RealtimeEvent,
} from "@/lib/ws";

/**
 * 订阅一种（或几种，传模块级常量数组）type 的事件。handler / type 变了就重新订阅（退订 / 订阅在
 * 同一个 effect 里同步完成，中间不会漏帧），所以调用方用 useCallback 稳住 handler，别在这里用 ref
 * 绕过（react-hooks/refs）。payload 的类型由调用方按 @/lib/ws 里的 *EventPayload 指定；
 * 事件本身不是 diff，是后端实体形状。
 */
export function useRealtimeEvent<T>(
  type: string | readonly string[],
  handler: (payload: T, event: RealtimeEvent<T>) => void,
): void {
  useEffect(() => {
    const types = typeof type === "string" ? [type] : type;

    return subscribeRealtime((event) => {
      if (!types.includes(event.type)) return;

      const typed = event as RealtimeEvent<T>;

      handler(typed.payload, typed);
    });
  }, [type, handler]);
}

/** 连接状态（给 container 决定要不要显示「离线」角标）。 */
export function useRealtimeStatus() {
  return useSyncExternalStore(
    subscribeConnectionStatus,
    getConnectionStatus,
    () => "idle" as const,
  );
}

/**
 * 应用级连接的生命周期：登录态就绪时建连，登出（会话变 null）时断开并清 lastSeq。
 * 挂在应用壳（根 layout）里一次；没有卸载清理 —— 路由切换 / StrictMode 双挂载都不该断线。
 */
export function useRealtimeConnection(): void {
  const enabled = useSession() !== null;

  useEffect(() => {
    if (enabled) connectRealtime();
    else disconnectRealtime();
  }, [enabled]);
}

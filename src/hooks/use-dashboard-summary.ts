// 工作台概览（GET /api/dashboard/summary）：工作台的指标卡 / 「需要处理」与侧栏「异常中心」的未处理数徽标共用一份缓存。
// 刷新两条腿：30 秒轮询兜底（refetchInterval，api.params-in-key 不用 useEffect）+ 相关 WS 事件到达时 invalidate。
//
// 事件 → 缓存的同步只在应用壳里挂一次（useDashboardSummarySync）：两个地方各订阅一遍的话，同一条
// inconsistency 事件会让未处理数 +2。未处理数先就地改（徽标立刻变），再 invalidate 拿权威值。

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { viewerTimeZone } from "@/lib/format-date";
import { queryKeys } from "@/lib/query-keys";
import { REALTIME_EVENT_TYPES, type RealtimeEvent } from "@/lib/ws";
import {
  type DashboardSummary,
  getDashboardSummary,
} from "@/services/dashboard-service";

const DASHBOARD_POLL_MS = 30_000;

/** 未处理异常数就地加减（不低于 0）；缓存里没有就不造。 */
export function adjustUnresolved(
  summary: DashboardSummary | undefined,
  delta: number,
): DashboardSummary | undefined {
  if (!summary) return summary;

  return {
    ...summary,
    inconsistencies: {
      ...summary.inconsistencies,
      unresolved: Math.max(0, summary.inconsistencies.unresolved + delta),
    },
  };
}

export function useDashboardSummary({ enabled = true } = {}) {
  // 「今日」按查看者时区算：同一个浏览器会话里时区不变，工作台与侧栏徽标仍共用一份缓存。
  const timeZone = viewerTimeZone();
  const query = useQuery({
    queryKey: queryKeys.dashboard.summary(timeZone),
    queryFn: () => getDashboardSummary(timeZone),
    enabled,
    refetchInterval: DASHBOARD_POLL_MS,
    // 侧栏徽标与工作台共用：失败由工作台的错误卡展示，不在每个页面弹 toast。
    meta: { silent: true },
  });

  return {
    timeZone,
    summary: query.data,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

/** 应用壳挂一次：WS 事件 → 概览缓存。计数全在后端算，这里只 invalidate（不打断正在进行的那次拉取）。 */
export function useDashboardSummarySync(): void {
  const queryClient = useQueryClient();

  const onEvent = useCallback(
    (_payload: unknown, event: RealtimeEvent) => {
      // 前缀：不管缓存按哪个时区建的都改到
      const key = queryKeys.dashboard.summary();

      if (event.type === "inconsistency")
        queryClient.setQueriesData<DashboardSummary>({ queryKey: key }, (old) =>
          adjustUnresolved(old, 1),
        );
      else if (event.type === "inconsistency_resolved")
        queryClient.setQueriesData<DashboardSummary>({ queryKey: key }, (old) =>
          adjustUnresolved(old, -1),
        );

      // 连续一串事件（60 条消息）只会留一次在途的请求：cancelRefetch=false 不打断正在进行的拉取。
      void queryClient.invalidateQueries(
        { queryKey: key },
        { cancelRefetch: false },
      );
    },
    [queryClient],
  );

  useRealtimeEvent(REALTIME_EVENT_TYPES, onEvent);
}

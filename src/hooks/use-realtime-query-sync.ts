// 应用级「事件 → 缓存」同步（frontend-realtime-events「订阅」；前端 #16）：在应用壳里挂一次，
// 不管当前挂着哪个页面，每条事件都让它影响到的查询按 key invalidate。
//
// 起因：订阅以前分散在各页面的 hook 里，页面卸载就退订，而 lastSeq 照常前进、不会补发；staleTime
// 30 秒内回到页面直接用旧缓存 —— 例如在 run 详情页期间 run 变成 blocked，回到群详情仍显示 running、
// 没有醒目提示，期间的新消息也不出现。现在由这里统一 invalidate（默认 refetchType "active"）：
// - 有页面挂着的查询立刻重拉；
// - 没人看的缓存只标过期（不白拉），下次挂载时重拉；
// - 没人看、但请求还在路上的缓存：那次请求回来会把「已过期」标记清掉，而它的结果可能早于这条事件
//   （例如刚离开页面时发出的请求）—— 等它结束再标一次。
// 页面在挂着时自己就地合并的缓存（时间线的最新页并入、动态流插头，pageMerges）不在这里重拉 ——
// 整体重拉无限列表会把已加载的每一页顺序拉一遍；这里只处理没人看的那份。
// 页面里只留「特殊处理」的订阅（就地并入 / 就地改字段 / toast），不再各写一遍 invalidate。
// 账号域（useAccountEvents）与工作台概览（useDashboardSummarySync）各有就地改的逻辑，同样挂在应用壳里。

import {
  type Query,
  type QueryClient,
  type QueryKey,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import {
  ACTIVITY_EVENT_TYPES,
  type AgentRunEventPayload,
  type InconsistencyResolvedEventPayload,
  type MessageEventPayload,
  REALTIME_EVENT_TYPES,
  type RealtimeEvent,
} from "@/lib/ws";
import type { JobEventPayload } from "@/services/job-service";
import type { SequenceRunEventPayload } from "@/services/sequence-service";

interface RealtimeQueryTarget {
  queryKey: QueryKey;
  /** 页面挂着时由它自己的订阅就地合并：只 invalidate 没人看的那份。 */
  pageMerges?: true;
}

function domainTargets(event: RealtimeEvent): RealtimeQueryTarget[] {
  switch (event.type) {
    case "message": {
      const { groupId } = event.payload as MessageEventPayload;

      return [
        { queryKey: queryKeys.messages.timeline(groupId), pageMerges: true },
      ];
    }

    case "agent_run": {
      const { runId, groupId } = event.payload as AgentRunEventPayload;

      // 群列表 / 群详情里有进行中的 run（activeAgentRunId）。
      return [
        { queryKey: queryKeys.agentRuns.detail(runId) },
        { queryKey: queryKeys.agentRuns.byGroup(groupId) },
        { queryKey: queryKeys.agentRuns.lists() },
        { queryKey: queryKeys.groups.all },
      ];
    }

    case "sequence_run": {
      const { runId, groupId } = event.payload as SequenceRunEventPayload;

      // 群详情的 activeSequenceRunId 跟着 run 的开始 / 结束变。
      return [
        { queryKey: queryKeys.sequenceRuns.detail(runId) },
        { queryKey: queryKeys.groups.detail(groupId) },
      ];
    }

    case "job": {
      const { jobId } = event.payload as JobEventPayload;

      // 建群 / 全部退群改的是群列表。
      return [
        { queryKey: queryKeys.jobs.detail(jobId) },
        { queryKey: queryKeys.groups.all },
      ];
    }

    // 事件只带 id 与变化，不是整行：群列表与群详情按域前缀重拉。
    case "member_changed":
    case "group_status_changed":
    case "group_settings_changed":
      return [{ queryKey: queryKeys.groups.all }];

    case "inconsistency":
      return [{ queryKey: queryKeys.inconsistencies.lists() }];

    case "inconsistency_resolved": {
      const { id } = event.payload as InconsistencyResolvedEventPayload;

      return [
        { queryKey: queryKeys.inconsistencies.lists() },
        { queryKey: queryKeys.inconsistencies.detail(id) },
      ];
    }

    default:
      return [];
  }
}

/** 一条事件影响到的查询（纯函数，账号域与概览不在这里，见文件头）。 */
export function realtimeQueryTargets(
  event: RealtimeEvent,
): RealtimeQueryTarget[] {
  const targets = domainTargets(event);

  // 动态流（工作台 / 实时动态页）按 seq 插头。
  if ((ACTIVITY_EVENT_TYPES as readonly string[]).includes(event.type))
    targets.push({ queryKey: queryKeys.activity.all, pageMerges: true });

  return targets;
}

/** 已经在等请求结束再标过期的缓存（同一次请求期间来多条事件只标一次）。 */
const expiringAfterFetch = new WeakSet<Query>();

/**
 * 请求结束后再 invalidate 一次。那时若已回到页面（挂载时复用了这次请求），它的页面订阅没收到过这条事件，
 * 所以不分 pageMerges、照常重拉挂着的那份。
 */
function expireAfterFetch(queryClient: QueryClient, query: Query): void {
  if (expiringAfterFetch.has(query)) return;

  expiringAfterFetch.add(query);

  const cache = queryClient.getQueryCache();
  const unsubscribe = cache.subscribe((event) => {
    if (event.query !== query) return;

    if (event.type !== "removed" && query.state.fetchStatus !== "idle") return;

    unsubscribe();
    expiringAfterFetch.delete(query);

    if (event.type !== "removed")
      void queryClient.invalidateQueries({
        queryKey: query.queryKey,
        exact: true,
      });
  });
}

function syncTarget(
  queryClient: QueryClient,
  { queryKey, pageMerges }: RealtimeQueryTarget,
): void {
  void queryClient.invalidateQueries(
    pageMerges
      ? { queryKey, refetchType: "none", predicate: (q) => !q.isActive() }
      : { queryKey },
  );

  for (const query of queryClient.getQueryCache().findAll({ queryKey }))
    if (!query.isActive() && query.state.fetchStatus !== "idle")
      expireAfterFetch(queryClient, query);
}

/** 应用壳挂一次（app-shell-container）。 */
export function useRealtimeQuerySync(): void {
  const queryClient = useQueryClient();

  const onEvent = useCallback(
    (_payload: unknown, event: RealtimeEvent) => {
      for (const target of realtimeQueryTargets(event))
        syncTarget(queryClient, target);
    },
    [queryClient],
  );

  useRealtimeEvent(REALTIME_EVENT_TYPES, onEvent);
}

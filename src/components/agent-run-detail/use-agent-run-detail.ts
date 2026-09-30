// 某次 agent run 的详情（前端 #5）：GET /api/agent-runs/:id → 缓存。
// 实时：WS `agent_run` 事件只带 { runId, groupId, status, endReason }，不是整行，而且后端只在 run 创建
// 与结束时发（每一步不发事件），所以同 runId 的事件一律 invalidate 重拉；running 期间再按固定间隔
// 轮询把步骤刷出来（api.params-in-key：轮询用 refetchInterval，不用 useEffect）。

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import type { AgentRunEventPayload } from "@/lib/ws";
import { getAgentRun } from "@/services/agent-run-service";

/** running 的 run 每隔这么久重拉一次步骤（run 上限 12 步 / 60 秒，2 秒足够跟得上）。 */
export const RUNNING_POLL_MS = 2_000;

export function useAgentRunDetail(runId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.agentRuns.detail(runId),
    queryFn: () => getAgentRun(runId),
    refetchInterval: (q) =>
      q.state.data?.status === "running" ? RUNNING_POLL_MS : false,
    // 主查询：404 / 失败由 view 渲染错误卡，不再弹 toast。
    meta: { silent: true },
  });

  useRealtimeEvent<AgentRunEventPayload>(
    "agent_run",
    useCallback(
      (payload) => {
        if (payload.runId !== runId) return;

        void queryClient.invalidateQueries({
          queryKey: queryKeys.agentRuns.detail(runId),
        });
      },
      [runId, queryClient],
    ),
  );

  return {
    run: query.data,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
    /** 审计拿不到结论被拦下的 run（endReason = audit_blocked）：页面顶部要醒目提示。 */
    blocked: query.data?.status === "blocked",
  };
}

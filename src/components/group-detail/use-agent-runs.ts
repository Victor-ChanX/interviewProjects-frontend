// 某群的 agent run 列表（最新在前）：GET /api/groups/:id/agent-runs；WS `agent_run` 事件只带
// { runId, groupId, status, endReason }，不是整行，所以本群的事件一律 invalidate 重拉。

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import type { AgentRunEventPayload } from "@/lib/ws";
import { listGroupAgentRuns } from "@/services/agent-run-service";

export function useAgentRuns(groupId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.agentRuns.byGroup(groupId),
    queryFn: () => listGroupAgentRuns(groupId),
  });

  useRealtimeEvent<AgentRunEventPayload>(
    "agent_run",
    useCallback(
      (payload) => {
        if (payload.groupId !== groupId) return;

        void queryClient.invalidateQueries({
          queryKey: queryKeys.agentRuns.byGroup(groupId),
        });
      },
      [groupId, queryClient],
    ),
  );

  return {
    runs: query.data?.items ?? [],
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

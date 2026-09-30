// 某群的 agent run 列表（最新在前）：GET /api/groups/:id/agent-runs；WS `agent_run` 事件只带
// { runId, groupId, status, endReason }，不是整行，本群的事件由应用壳的 useRealtimeQuerySync 按 key
// invalidate 重拉（页面不在时也会让缓存过期，回来就重拉）。

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { listGroupAgentRuns } from "@/services/agent-run-service";

export function useAgentRuns(groupId: string) {
  const query = useQuery({
    queryKey: queryKeys.agentRuns.byGroup(groupId),
    queryFn: () => listGroupAgentRuns(groupId),
  });

  return {
    runs: query.data?.items ?? [],
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

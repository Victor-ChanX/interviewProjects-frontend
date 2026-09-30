// 某次 agent run 的详情（前端 #5）：GET /api/agent-runs/:id → 缓存。
// 实时：WS `agent_run` 事件只带 { runId, groupId, status, endReason }，不是整行，而且后端只在 run 创建
// 与结束时发（每一步不发事件）—— 同 runId 的事件由应用壳的 useRealtimeQuerySync 按 key invalidate 重拉；
// running 期间再按固定间隔轮询把步骤刷出来（api.params-in-key：轮询用 refetchInterval，不用 useEffect）。

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/lib/query-keys";
import { groupDisplayName, shortId } from "@/lib/short-id";
import { getAgentRun } from "@/services/agent-run-service";
import { listGroups } from "@/services/group-service";

/** running 的 run 每隔这么久重拉一次步骤（run 上限 12 步 / 60 秒，2 秒足够跟得上）。 */
export const RUNNING_POLL_MS = 2_000;

export function useAgentRunDetail(runId: string) {
  const query = useQuery({
    queryKey: queryKeys.agentRuns.detail(runId),
    queryFn: () => getAgentRun(runId),
    refetchInterval: (q) =>
      q.state.data?.status === "running" ? RUNNING_POLL_MS : false,
    // 主查询：404 / 失败由 view 渲染错误卡，不再弹 toast。
    meta: { silent: true },
  });

  // 只为把 groupId 翻成网关群 ID：群列表拉不到就显示缩写的 id，不打扰用户。
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
    meta: { silent: true },
  });
  const groupId = query.data?.groupId;
  const groups = groupsQuery.data;
  const groupName = useMemo(() => {
    if (!groupId) return "";

    const group = groups?.find((item) => item.id === groupId);

    return group ? groupDisplayName(group) : shortId(groupId);
  }, [groupId, groups]);

  return {
    run: query.data,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
    /** 审计拿不到结论被拦下的 run（endReason = audit_blocked）：页面顶部要醒目提示。 */
    blocked: query.data?.status === "blocked",
    groupName,
  };
}

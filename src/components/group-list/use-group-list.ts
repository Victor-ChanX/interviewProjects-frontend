// 群列表：GET /api/groups（裸数组、无参数）。群状态 / 开关 / 成员 / 进行中的 run 变化都会改列表里的列，
// 事件只带 id 与变化，不是整行，所以一律按域前缀 invalidate 重拉（列表不大，不逐行打补丁）。

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import { listGroups } from "@/services/group-service";

const GROUP_LIST_EVENTS = [
  "group_status_changed",
  "group_settings_changed",
  "member_changed",
  "agent_run",
  "job",
] as const;

export function useGroupList() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
  }, [queryClient]);

  useRealtimeEvent(GROUP_LIST_EVENTS, invalidate);

  return {
    groups: query.data ?? [],
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

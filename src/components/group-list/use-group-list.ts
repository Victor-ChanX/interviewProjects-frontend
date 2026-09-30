// 群列表：GET /api/groups（裸数组、无参数）。群状态 / 开关 / 成员 / 进行中的 run / 建群任务都会改列表里的列，
// 事件只带 id 与变化，不是整行，由应用壳的 useRealtimeQuerySync 按域前缀 invalidate 重拉（列表不大，不逐行打补丁）。

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { listGroups } from "@/services/group-service";

export function useGroupList() {
  const query = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
  });

  return {
    groups: query.data ?? [],
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

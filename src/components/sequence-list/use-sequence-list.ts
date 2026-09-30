// 定时序列列表（GET /api/sequences，{ items, total }，序列天然不多、不分页）+「在群启动」要的群列表
// （只列状态正常的群）。启动本身在群的序列运行页做（预检弹窗逻辑都在那里）。

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/lib/query-keys";
import { groupDisplayName } from "@/lib/short-id";
import { listGroups } from "@/services/group-service";
import { listSequences } from "@/services/sequence-service";

import { toSequenceRow } from "./sequence-rows";

export function useSequenceList({ groupsEnabled }: { groupsEnabled: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.sequences.list(),
    queryFn: listSequences,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
    enabled: groupsEnabled,
  });

  const items = query.data?.items;
  const rows = useMemo(() => (items ?? []).map(toSequenceRow), [items]);

  const groups = groupsQuery.data;
  const groupOptions = useMemo(
    () =>
      (groups ?? [])
        .filter((group) => group.status === "active")
        .map((group) => ({ value: group.id, label: groupDisplayName(group) })),
    [groups],
  );

  return {
    rows,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
    groupOptions,
    groupsLoading: groupsEnabled && groupsQuery.isPending,
  };
}

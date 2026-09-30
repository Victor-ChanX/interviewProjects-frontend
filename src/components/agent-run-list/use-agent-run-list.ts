// 全局 Agent 运行列表（后端 #22 `GET /api/agent-runs?status=&groupId=&before=&limit=`）：
// 筛选（状态页签、按群）存 URL（nuqs：`?status=blocked&group=<id>`，工作台「需要处理」直接带参数跳进来），
// 游标分页用 useInfiniteQuery（「加载更多」接在最后一页）。WS `agent_run` 事件只带 { runId, groupId, status }，
// 本地判不出新 run 属不属于当前筛选，所以由应用壳的 useRealtimeQuerySync 按列表前缀 invalidate
// （maxPages 限住重拉的页数）。

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import { AGENT_RUN_STATUS_FILTERS } from "@/lib/agent-run-labels";
import { queryKeys } from "@/lib/query-keys";
import { groupDisplayName } from "@/lib/short-id";
import {
  type AgentRunListItem,
  listAgentRuns,
} from "@/services/agent-run-service";
import { listGroups } from "@/services/group-service";

const AGENT_RUN_PAGE_LIMIT = 30;

const MAX_PAGES = 10;

const FILTER_PARSERS = {
  status: parseAsStringLiteral(AGENT_RUN_STATUS_FILTERS).withDefault("all"),
  group: parseAsString.withDefault(""),
};

const NO_RUNS: AgentRunListItem[] = [];

export function useAgentRunList() {
  const [filters, setFilters] = useQueryStates(FILTER_PARSERS);
  const { status, group } = filters;

  const query = useInfiniteQuery({
    queryKey: queryKeys.agentRuns.list({ status, groupId: group }),
    queryFn: ({ pageParam }) =>
      listAgentRuns({
        status: status === "all" ? undefined : status,
        groupId: group || undefined,
        before: pageParam,
        limit: AGENT_RUN_PAGE_LIMIT,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    maxPages: MAX_PAGES,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
    meta: { silent: true },
  });

  const runs = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? NO_RUNS,
    [query.data],
  );

  const groups = groupsQuery.data;
  const groupOptions = useMemo(
    () =>
      (groups ?? []).map((item) => ({
        value: item.id,
        label: groupDisplayName(item),
      })),
    [groups],
  );

  const setStatus = useCallback(
    (next: (typeof AGENT_RUN_STATUS_FILTERS)[number]) => {
      void setFilters({ status: next === "all" ? null : next });
    },
    [setFilters],
  );
  const setGroup = useCallback(
    (next: string) => {
      void setFilters({ group: next || null });
    },
    [setFilters],
  );

  const { fetchNextPage, refetch } = query;

  return {
    status,
    group,
    setStatus,
    setGroup,
    groupOptions,
    runs,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching && !query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: fetchNextPage,
    refetch,
  };
}

// 实时动态流（后端 #22 GET /api/activity + WS）：工作台的动态卡片与实时动态页共用。
// 首屏 useInfiniteQuery（按 seq 倒序、游标在 pageParam 里），之后 WS 事件逐条插到最新页头部
// （src/lib/activity-cache.ts：按 seq 去重、旧页与游标不动）；工作台给 maxHead 只留最新 N 条。
// 事件描述在这里格式化好（src/lib/activity-format.ts），群名从群列表缓存里查网关群 ID。

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import {
  type ActivityData,
  eventToActivity,
  flattenActivity,
  prependActivity,
} from "@/lib/activity-cache";
import { formatActivity, type FormattedActivity } from "@/lib/activity-format";
import { queryKeys } from "@/lib/query-keys";
import { updateQueryData } from "@/lib/query-updates";
import { ACTIVITY_EVENT_TYPES, type RealtimeEvent } from "@/lib/ws";
import { listActivity } from "@/services/activity-service";
import { listGroups } from "@/services/group-service";

export interface UseActivityFeedOptions {
  /** 每页条数（首屏与「加载更早」）。 */
  limit: number;
  /** 最新页最多保留几条（工作台用；实时动态页不设）。 */
  maxHead?: number;
}

export function useActivityFeed({ limit, maxHead }: UseActivityFeedOptions) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.activity.feed(limit),
    queryFn: ({ pageParam }) => listActivity({ before: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // 首屏之后全靠 WS 追加；缓存过期后重拉会把实时插进来的项与服务端对齐（seq 相同，不重复）。
    staleTime: 60_000,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: listGroups,
    // 只用来把 groupId 翻成网关群 ID：拉不到就显示缩写的 id，不打扰用户。
    meta: { silent: true },
  });

  const onEvent = useCallback(
    (_payload: unknown, event: RealtimeEvent) => {
      const item = eventToActivity(event, new Date().toISOString());

      if (!item) return;

      // 「加载更早」/ 过期重拉进行中也不能被它的写回盖掉（前端 #16）。
      updateQueryData<ActivityData>(
        queryClient,
        queryKeys.activity.feed(limit),
        (old) => prependActivity(old, item, maxHead),
      );
    },
    [limit, maxHead, queryClient],
  );

  useRealtimeEvent(ACTIVITY_EVENT_TYPES, onEvent);

  const groups = groupsQuery.data;
  const entries = useMemo<FormattedActivity[]>(() => {
    const names = new Map(
      (groups ?? []).map((group) => [group.id, group.gatewayGroupId]),
    );
    const groupName = (id: string) => names.get(id) ?? null;

    return flattenActivity(query.data).map((item) =>
      formatActivity(item, { groupName }),
    );
  }, [groups, query.data]);

  const { fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return {
    entries,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching && !query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore,
    refetch,
  };
}

// 群消息时间线：游标分页（useInfiniteQuery，「加载更早」用上一页的 nextCursor）+ 实时追加并存。
//
// WS `message` 事件只带 { groupId, msgId, isOwn, clientMsgId?, deliveryStatus?, failCode? }，没有消息体：
// - 自己的消息（带 clientMsgId）且缓存里已有这一行 → 就地写 deliveryStatus / failCode / msgId（setQueryData 函数式更新）。
// - 其余（别人的新消息、或自己的消息还没进缓存）→ 重新拉一次最新页，按 key 并进 pages[0]：
//   已有的行整行替换、没见过的按 sentAt 倒序插入 —— 只碰最新页，旧页与游标不动，不重不漏。
//   不用 invalidateQueries：TanStack v5 会把已加载的每一页顺序重拉一遍（用户翻到第十页时十页全刷）。
//   拉最新页失败才退回 invalidate。缓存里还没有数据（old === undefined）时不造：查询自己会拉。
// 同一时刻多条事件只发一次请求：进行中的标记 again，完成后再拉一次兜住这期间的变化。

import {
  useInfiniteQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import type { MessageEventPayload } from "@/lib/ws";
import { listMessages, MESSAGE_PAGE_LIMIT } from "@/services/message-service";

import {
  applyDeliveryUpdate,
  flattenTimeline,
  mergeHeadPage,
  type TimelineData,
} from "./timeline-cache";

interface RefreshState {
  groupId: string;
  inFlight: boolean;
  again: boolean;
}

async function refreshHeadPage(
  queryClient: QueryClient,
  state: RefreshState,
): Promise<void> {
  if (state.inFlight) {
    state.again = true;

    return;
  }

  const { groupId } = state;

  state.inFlight = true;

  try {
    do {
      state.again = false;

      const page = await listMessages(groupId, { limit: MESSAGE_PAGE_LIMIT });

      queryClient.setQueryData<TimelineData>(
        queryKeys.messages.timeline(groupId),
        (old) => (old ? mergeHeadPage(old, page.items) : old),
      );
    } while (state.again);
  } catch {
    // 拉最新页失败：让 useInfiniteQuery 自己重拉（失败会走 query 的默认 toast）。
    void queryClient.invalidateQueries({
      queryKey: queryKeys.messages.timeline(groupId),
    });
  } finally {
    state.inFlight = false;
  }
}

export function useMessageTimeline(groupId: string) {
  const queryClient = useQueryClient();
  const refreshState = useRef<RefreshState | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.messages.timeline(groupId),
    queryFn: ({ pageParam }) =>
      listMessages(groupId, { before: pageParam, limit: MESSAGE_PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    // nextCursor 为 null = 没有更早的了。
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const onMessage = useCallback(
    (payload: MessageEventPayload) => {
      if (payload.groupId !== groupId) return;

      const current = queryClient.getQueryData<TimelineData>(
        queryKeys.messages.timeline(groupId),
      );

      if (!current) return;

      let matched = false;

      queryClient.setQueryData<TimelineData>(
        queryKeys.messages.timeline(groupId),
        (old) => {
          if (!old) return old;

          const next = applyDeliveryUpdate(old, payload);

          matched = next !== null;

          return next ?? old;
        },
      );

      if (matched) return;

      // 换了群就换一份状态；同群复用，保证单飞。
      if (refreshState.current?.groupId !== groupId)
        refreshState.current = { groupId, inFlight: false, again: false };

      void refreshHeadPage(queryClient, refreshState.current);
    },
    [groupId, queryClient],
  );

  useRealtimeEvent<MessageEventPayload>("message", onMessage);

  const { fetchNextPage } = query;
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const messages = useMemo(() => flattenTimeline(query.data), [query.data]);

  return {
    messages,
    loading: query.isPending && !query.data,
    error: query.error,
    // 「重试」在转的是首页重拉，不是「加载更早」。
    retrying: query.isFetching && !query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore,
    refetch: query.refetch,
  };
}

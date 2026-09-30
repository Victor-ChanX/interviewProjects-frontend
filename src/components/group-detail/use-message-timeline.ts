// 群消息时间线：游标分页（useInfiniteQuery，「加载更早」用上一页的 nextCursor）+ 实时追加并存。
//
// WS `message` 事件只带 { groupId, msgId, isOwn, clientMsgId?, deliveryStatus?, failCode?, sentAt? }，没有消息体：
// - 自己的消息（带 clientMsgId）且缓存里已有这一行 → 就地写 deliveryStatus / failCode / msgId（setQueryData 函数式更新），
//   带 sentAt 时按新时刻挪位置（受理时刻 → 网关时刻，前端 #17）；不带时位置等下一次最新页补拉纠正。
//   这时若补拉请求在途（请求发出时这一行还是旧状态），标记 again：它回来后再拉一轮，把这期间的变化带回来；
//   合并时也不让旧快照把 sent / failed / cancelled 退回去（timeline-cache 的 mergeRow）。
// - 其余（别人的新消息、或自己的消息还没进缓存）→ 从最新页起往前翻（before = 上一页的 nextCursor），
//   直到拉回的页接上缓存（timeline-cache 的 catchUpAnchor / reachesAnchor）—— 断线期间的新消息
//   超过一页时只拉最新一页，中间会留下「加载更早」也补不回来的空洞（前端 #14）。拉回的全部行按 key
//   并进 pages[0]：已有的行整行替换、没见过的按 sentAt 倒序插入 —— 只碰最新页，旧页与游标不动，不重不漏。
//   不用 invalidateQueries：TanStack v5 会把已加载的每一页顺序重拉一遍（用户翻到第十页时十页全刷）。
//   请求失败、或翻了 MAX_CATCH_UP_PAGES 页还没接上，才退回 invalidate（按页从最新重拉，同样没有空洞）。
//   缓存里还没有数据（old === undefined）时不造：查询自己会拉。
// 同一时刻多条事件只发一次请求：进行中的标记 again，完成后再拉一次兜住这期间的变化（就地写投递状态的事件也算）。
// 首页请求进行中到达的事件（首屏加载、invalidate 后的重拉）：那次请求可能早于这条消息落库，
// 缓存里又还没有数据可并 —— 记一笔，首页请求回来后再拉一次首页（前端 #14，headFetches）。
// 缓存里已有数据、但正在请求（「加载更早」、invalidate 后的整体重拉）时，这次请求结束会把开始时的
// 缓存副本整份写回，期间并进来的新消息 / 投递状态会被覆盖（前端 #16）—— 所有写时间线缓存的地方都走
// @/lib/query-updates 的 updateQueryData：立刻生效，并在请求结束后于写回结果上按顺序重放（更新都是幂等的）。

import {
  useInfiniteQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import { updateQueryData } from "@/lib/query-updates";
import type { MessageEventPayload } from "@/lib/ws";
import {
  listMessages,
  MESSAGE_PAGE_LIMIT,
  type MessagePage,
  type MessageRead,
} from "@/services/message-service";

import {
  applyDeliveryUpdate,
  catchUpAnchor,
  type CatchUpAnchor,
  flattenTimeline,
  mergeHeadPage,
  reachesAnchor,
  type TimelineData,
} from "./timeline-cache";

/** 断线补齐最多往前翻的页数；还没接上就退回 invalidate。 */
const MAX_CATCH_UP_PAGES = 20;

/**
 * 首页请求因期间来了事件而重拉的上限：消息不停的群里不能一直拉不完。到上限后照常落缓存，
 * 最后那段时间的新消息由下一条事件的补齐（往前翻到接上）带回来。
 */
const MAX_HEAD_REFETCHES = 3;

interface RefreshState {
  groupId: string;
  inFlight: boolean;
  again: boolean;
}

/**
 * 各群「首页请求进行中」的计数与「期间来过 message 事件」标记。模块级：查询缓存是全局的，
 * 同一个群的首页请求被几个组件实例共用；计数归零即删，不留状态。
 */
const headFetches = new Map<string, { inFlight: number; dirty: boolean }>();

/**
 * useInfiniteQuery 的首页请求：进行中来过 message 事件就再拉一次，直到一次请求期间没有新事件
 * （最多多拉 MAX_HEAD_REFETCHES 次）。
 */
async function fetchHeadPage(groupId: string): Promise<MessagePage> {
  const tracker = headFetches.get(groupId) ?? { inFlight: 0, dirty: false };

  headFetches.set(groupId, tracker);
  tracker.inFlight += 1;

  try {
    for (let refetches = 0; ; refetches += 1) {
      tracker.dirty = false;

      const page = await listMessages(groupId, {
        before: undefined,
        limit: MESSAGE_PAGE_LIMIT,
      });

      if (!tracker.dirty || refetches >= MAX_HEAD_REFETCHES) return page;
    }
  } finally {
    tracker.inFlight -= 1;

    if (tracker.inFlight === 0) headFetches.delete(groupId);
  }
}

/**
 * 从最新页往前翻到接上 anchor（或翻到头）为止，返回拉回的全部行（倒序）。
 * anchor 为 null（缓存里一条都没有）时翻到头。翻满 MAX_CATCH_UP_PAGES 还没接上返回 null。
 */
async function fetchUntilCached(
  groupId: string,
  anchor: CatchUpAnchor | null,
): Promise<MessageRead[] | null> {
  const items: MessageRead[] = [];
  let before: string | undefined;

  for (let fetched = 0; fetched < MAX_CATCH_UP_PAGES; fetched += 1) {
    const page = await listMessages(
      groupId,
      before === undefined
        ? { limit: MESSAGE_PAGE_LIMIT }
        : { before, limit: MESSAGE_PAGE_LIMIT },
    );

    items.push(...page.items);

    if (!page.nextCursor || (anchor && reachesAnchor(page.items, anchor)))
      return items;

    before = page.nextCursor;
  }

  return null;
}

function invalidateTimeline(queryClient: QueryClient, groupId: string): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.messages.timeline(groupId),
  });
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
  const key = queryKeys.messages.timeline(groupId);

  state.inFlight = true;

  try {
    do {
      state.again = false;

      const cached = queryClient.getQueryData<TimelineData>(key);

      // 缓存被清掉了（换账号 / 移除）：不造，查询自己会拉。
      if (!cached) continue;

      // 接上点按本轮开始时的缓存取；补拉那一轮会按届时的缓存重新取。
      const fresh = await fetchUntilCached(groupId, catchUpAnchor(cached));

      if (fresh === null) {
        // 断线太久、翻了很多页还没接上：不再逐页补，按页从最新整体重拉。
        invalidateTimeline(queryClient, groupId);

        return;
      }

      updateQueryData<TimelineData>(queryClient, key, (old) =>
        mergeHeadPage(old, fresh),
      );
    } while (state.again);
  } catch {
    // 补拉失败：让 useInfiniteQuery 自己重拉（失败会走 query 的默认 toast）。
    invalidateTimeline(queryClient, groupId);
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
      pageParam === undefined
        ? fetchHeadPage(groupId)
        : listMessages(groupId, {
            before: pageParam,
            limit: MESSAGE_PAGE_LIMIT,
          }),
    initialPageParam: undefined as string | undefined,
    // nextCursor 为 null = 没有更早的了。
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const onMessage = useCallback(
    (payload: MessageEventPayload) => {
      if (payload.groupId !== groupId) return;

      // 首页请求进行中：它回来后会再拉一次首页（缓存里还没有数据时，这是唯一不丢这条的办法）。
      const headFetch = headFetches.get(groupId);

      if (headFetch) headFetch.dirty = true;

      const key = queryKeys.messages.timeline(groupId);
      const current = queryClient.getQueryData<TimelineData>(key);

      if (!current) return;

      // 换了群就换一份状态；同群复用，保证单飞。
      if (refreshState.current?.groupId !== groupId)
        refreshState.current = { groupId, inFlight: false, again: false };

      const state = refreshState.current;

      // 缓存里已有这一行（自己的消息）：就地写投递状态。
      if (applyDeliveryUpdate(current, payload)) {
        updateQueryData<TimelineData>(
          queryClient,
          key,
          (old) => applyDeliveryUpdate(old, payload) ?? old,
        );

        // 在途的补拉拿的是这次更新之前的快照：回来后再拉一轮（前端 #17）。
        if (state.inFlight) state.again = true;

        return;
      }

      void refreshHeadPage(queryClient, state);
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

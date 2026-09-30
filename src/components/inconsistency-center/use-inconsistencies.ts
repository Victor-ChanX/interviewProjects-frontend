// 异常中心这一条业务流（后端 #22）：页签（未处理 / 已处理，URL：`?tab=resolved`）→ 游标列表
// （GET /api/inconsistencies?resolved=，useInfiniteQuery）→ 点一行在抽屉里看详情（GET /api/inconsistencies/:id，含 payload）
// → admin「标记已处理」（POST …/resolve，幂等，返回含 resolvedBy）。
// 实时：`inconsistency`（新记录）与 `inconsistency_resolved`（别人标记了）都让两个页签的列表重拉；
// 被标记的那条详情就地写 resolvedAt / resolvedBy。未处理数（侧栏徽标、工作台）由应用壳的概览同步负责，这里不碰。
// 抽屉「开 / 看哪条」是两个 state：关只切 open，选中的那条留到下次打开再覆盖（浮层淡出期间内容不闪空）。

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import type { InconsistencyTab } from "@/lib/inconsistency-labels";
import { queryKeys } from "@/lib/query-keys";
import type { InconsistencyResolvedEventPayload } from "@/lib/ws";
import {
  getInconsistency,
  type InconsistencyDetail,
  type InconsistencyRead,
  listInconsistencies,
  resolveInconsistency,
} from "@/services/inconsistency-service";

const INCONSISTENCY_PAGE_LIMIT = 50;

const TABS = [
  "open",
  "resolved",
] as const satisfies readonly InconsistencyTab[];

const INCONSISTENCY_EVENTS = [
  "inconsistency",
  "inconsistency_resolved",
] as const;

const NO_ITEMS: InconsistencyRead[] = [];

export function useInconsistencies() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("open"),
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.inconsistencies.list(tab),
    queryFn: ({ pageParam }) =>
      listInconsistencies({
        tab,
        before: pageParam,
        limit: INCONSISTENCY_PAGE_LIMIT,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    maxPages: 10,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.inconsistencies.detail(selectedId ?? ""),
    queryFn: () => getInconsistency(selectedId ?? ""),
    enabled: selectedId !== null,
    // 抽屉里渲染错误，不另弹 toast。
    meta: { silent: true },
  });

  const invalidateLists = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.inconsistencies.lists(),
    });
  }, [queryClient]);

  useRealtimeEvent<unknown>(
    INCONSISTENCY_EVENTS,
    useCallback(
      (payload, event) => {
        if (event.type === "inconsistency_resolved") {
          const resolved = payload as InconsistencyResolvedEventPayload;

          queryClient.setQueryData<InconsistencyDetail>(
            queryKeys.inconsistencies.detail(resolved.id),
            (old) =>
              old
                ? {
                    ...old,
                    resolvedAt: resolved.resolvedAt,
                    resolvedBy: resolved.resolvedBy,
                  }
                : old,
          );
        }

        invalidateLists();
      },
      [invalidateLists, queryClient],
    ),
  );

  const mutation = useMutation({
    mutationFn: (id: string) => resolveInconsistency(id),
  });
  const { mutateAsync } = mutation;

  /** 标记已处理；成功后用返回的记录覆盖详情并重拉列表。抛错交给容器 toast。 */
  const resolve = useCallback(
    async (id: string): Promise<InconsistencyRead> => {
      const row = await mutateAsync(id);

      queryClient.setQueryData<InconsistencyDetail>(
        queryKeys.inconsistencies.detail(id),
        (old) => (old ? { ...old, ...row } : old),
      );
      invalidateLists();

      return row;
    },
    [invalidateLists, mutateAsync, queryClient],
  );

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  }, []);

  const changeTab = useCallback(
    (next: InconsistencyTab) => {
      void setTab(next === "open" ? null : next);
    },
    [setTab],
  );

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? NO_ITEMS,
    [query.data],
  );

  const { fetchNextPage, refetch } = query;

  return {
    tab,
    changeTab,
    items,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching && !query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: fetchNextPage,
    refetch,
    detailOpen,
    setDetailOpen,
    openDetail,
    detail: detailQuery.data,
    detailLoading: selectedId !== null && detailQuery.isPending,
    detailError: detailQuery.error,
    resolve,
    resolving: mutation.isPending,
  };
}

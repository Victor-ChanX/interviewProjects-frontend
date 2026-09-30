// feature hook：useQuery 只在这里调；筛选条件同步到 URL（nuqs）。

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

import { queryKeys } from "@/lib/query-keys";
import { listExamples } from "@/services/example-service";

import type { ExampleListFilters } from "./types";

const LIST_QUERY_PARSERS = {
  keyword: parseAsString.withDefault(""),
};

export function useExampleList() {
  const [filters, setFilters] = useQueryStates(LIST_QUERY_PARSERS);

  // 空串转 undefined：不把空参数带进 URL 与 queryKey。
  const listParams = useMemo(
    () => ({ keyword: filters.keyword || undefined }),
    [filters.keyword],
  );

  const query = useQuery({
    queryKey: queryKeys.examples.list(listParams),
    queryFn: () => listExamples(listParams),
    // 搜索框类列表：换 key 时保留上一份数据，避免整张表闪成骨架。
    placeholderData: keepPreviousData,
  });

  const onFiltersChange = useCallback(
    (next: ExampleListFilters) => {
      void setFilters({ keyword: next.keyword });
    },
    [setFilters],
  );

  return {
    items: query.data?.items ?? [],
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    filters: { keyword: filters.keyword } satisfies ExampleListFilters,
    onFiltersChange,
    refetch: query.refetch,
  };
}

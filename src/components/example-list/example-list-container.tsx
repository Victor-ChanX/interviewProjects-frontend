// container：数据编排、路由副作用、实时订阅；渲染就绪的数据与回调通过 props 交给 view。

import { useCallback } from "react";
import { useNavigate } from "react-router";

import { useRealtimeExamples, useRealtimeStatus } from "@/hooks/use-realtime";

import { ExampleListView } from "./example-list-view";
import { useExampleList } from "./use-example-list";

export function ExampleListContainer() {
  const navigate = useNavigate();
  const list = useExampleList();
  const connection = useRealtimeStatus();

  useRealtimeExamples();

  const onOpen = useCallback(
    (id: number) => {
      void navigate(`/example/${id}`);
    },
    [navigate],
  );

  const onRetry = useCallback(() => {
    void list.refetch();
  }, [list]);

  return (
    <ExampleListView
      items={list.items}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      filters={list.filters}
      connection={connection}
      onFiltersChange={list.onFiltersChange}
      onRetry={onRetry}
      onOpen={onOpen}
    />
  );
}

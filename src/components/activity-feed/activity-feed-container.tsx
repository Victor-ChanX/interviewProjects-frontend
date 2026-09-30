// container：实时动态页的编排（动态流 + 类型筛选）；页签的文案与计数在这里拼好交给 view。

import { useCallback, useMemo } from "react";

import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABELS,
} from "@/lib/activity-format";

import { ActivityFeedView } from "./activity-feed-view";
import type { ActivityFeedViewProps } from "./types";
import { useActivityPage } from "./use-activity-page";

export function ActivityFeedContainer() {
  const page = useActivityPage();
  const { counts, total, refetch } = page;

  const typeOptions = useMemo<ActivityFeedViewProps["typeOptions"]>(
    () => [
      { value: "all", label: "全部", count: total },
      ...ACTIVITY_CATEGORIES.map((category) => ({
        value: category,
        label: ACTIVITY_CATEGORY_LABELS[category],
        count: counts[category] ?? 0,
      })),
    ],
    [counts, total],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <ActivityFeedView
      type={page.type}
      typeOptions={typeOptions}
      onTypeChange={page.changeType}
      entries={page.visible}
      total={total}
      now={page.now}
      loading={page.loading}
      error={page.error}
      retrying={page.retrying}
      onRetry={onRetry}
      hasMore={page.hasMore}
      loadingMore={page.loadingMore}
      onLoadMore={page.loadMore}
    />
  );
}

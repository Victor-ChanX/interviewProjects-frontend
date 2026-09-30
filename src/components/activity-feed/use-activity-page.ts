// 实时动态页：动态流（首屏 50 条、「加载更早」按游标接在后面、WS 事件插到最前）+ 类型筛选（URL：`?type=message`）。
// 后端 GET /api/activity 不支持按类型筛，所以筛选在已加载的条目上做；「加载更早」照常按游标往前翻。

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";

import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useNow } from "@/hooks/use-now";
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
} from "@/lib/activity-format";

const ACTIVITY_PAGE_LIMIT = 50;

const TYPE_FILTERS = ["all", ...ACTIVITY_CATEGORIES] as const;

export type ActivityTypeFilter = (typeof TYPE_FILTERS)[number];

const NOW_TICK_MS = 30_000;

export function useActivityPage() {
  const feed = useActivityFeed({ limit: ACTIVITY_PAGE_LIMIT });
  const now = useNow(NOW_TICK_MS);
  const [type, setType] = useQueryState(
    "type",
    parseAsStringLiteral(TYPE_FILTERS).withDefault("all"),
  );

  const { entries } = feed;
  const counts = useMemo(() => {
    const result: Partial<Record<ActivityCategory, number>> = {};

    for (const entry of entries)
      if (entry.category)
        result[entry.category] = (result[entry.category] ?? 0) + 1;

    return result;
  }, [entries]);

  const visible = useMemo(
    () =>
      type === "all"
        ? entries
        : entries.filter((entry) => entry.category === type),
    [entries, type],
  );

  const changeType = useCallback(
    (next: ActivityTypeFilter) => {
      void setType(next === "all" ? null : next);
    },
    [setType],
  );

  return {
    ...feed,
    now,
    type,
    changeType,
    counts,
    total: entries.length,
    visible,
  };
}

// 工作台这一页的数据：概览计数（30 秒轮询 + WS invalidate，缓存与侧栏徽标共用）→ 指标卡 / 「需要处理」；
// 实时动态（首屏 20 条，之后 WS 逐条插到顶部，最多留 50 条）；相对时间用的 now 每 30 秒走一次。

import { useCallback, useMemo } from "react";

import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { useNow } from "@/hooks/use-now";
import { businessDate, formatDateTime } from "@/lib/format-date";

import { buildAttentionItems, buildStatCards } from "./dashboard-cards";

const DASHBOARD_ACTIVITY_LIMIT = 20;

const DASHBOARD_ACTIVITY_MAX = 50;

const NOW_TICK_MS = 30_000;

export function useDashboard() {
  const summaryState = useDashboardSummary();
  const activity = useActivityFeed({
    limit: DASHBOARD_ACTIVITY_LIMIT,
    maxHead: DASHBOARD_ACTIVITY_MAX,
  });
  const now = useNow(NOW_TICK_MS);
  const { summary } = summaryState;

  const cards = useMemo(
    () => (summary ? buildStatCards(summary) : []),
    [summary],
  );
  const attention = useMemo(
    () => (summary ? buildAttentionItems(summary) : []),
    [summary],
  );

  const { refetch: refetchSummary } = summaryState;
  const { refetch: refetchActivity } = activity;

  const refresh = useCallback(() => {
    void refetchSummary();
    void refetchActivity();
  }, [refetchActivity, refetchSummary]);

  return {
    today: businessDate(new Date(now)),
    updatedAt: summary ? formatDateTime(summary.generatedAt) : null,
    loading: summaryState.loading,
    error: summaryState.error,
    retrying: summaryState.retrying,
    refresh,
    cards,
    attention,
    now,
    activity,
  };
}

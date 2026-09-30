import type { FormattedActivity } from "@/lib/activity-format";

import type { AttentionItem, StatCard } from "./dashboard-cards";

export interface QuickAction {
  key: "createGroup" | "accounts" | "llmSettings";
  label: string;
  href: string;
}

export interface DashboardActivityViewProps {
  entries: FormattedActivity[];
  now: number;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}

export interface DashboardViewProps {
  /** 查看者时区的「今天」（YYYY-MM-DD）。 */
  today: string;
  /** 查看者（浏览器）时区；「今天」与「今日」计数都按它。 */
  timeZone: string;
  /** 概览最后一次拉到的时刻（已格式化）；还没拉到为 null。 */
  updatedAt: string | null;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRefresh: () => void;
  cards: StatCard[];
  attention: AttentionItem[];
  quickActions: QuickAction[];
  activity: DashboardActivityViewProps;
}

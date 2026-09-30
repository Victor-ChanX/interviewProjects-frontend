// 实时动态的列表：图标 + 一句中文描述 + 相对时间。工作台的动态卡片与实时动态页共用。纯展示：
// 描述已由 src/lib/activity-format.ts 格式化好，时间标签按调用方给的 now 算（渲染期不 new Date()）。

import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarClock,
  ListChecks,
  MessageSquare,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";

import {
  ACTIVITY_CATEGORY_LABELS,
  type ActivityCategory,
  activityTimeLabel,
  type FormattedActivity,
} from "@/lib/activity-format";
import { formatDateTime } from "@/lib/format-date";
import { STATUS_TONE_CLASS, STATUS_TONE_TEXT_CLASS } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Readonly<Record<ActivityCategory, typeof Activity>> = {
  account: UserRound,
  message: MessageSquare,
  agent: Bot,
  sequence: CalendarClock,
  group: UsersRound,
  job: ListChecks,
  inconsistency: AlertTriangle,
};

export interface ActivityListProps {
  entries: readonly FormattedActivity[];
  now: number;
  /** 紧凑模式（工作台卡片）：不显示分类标签。 */
  compact?: boolean;
  className?: string;
}

export function ActivityList({
  entries,
  now,
  compact = false,
  className,
}: ActivityListProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((entry) => {
        const Icon = entry.category ? CATEGORY_ICONS[entry.category] : Activity;

        return (
          <li
            key={entry.key}
            className="flex items-start gap-3 border-b border-border/60 py-2.5 last:border-b-0 animate-in fade-in-0 slide-in-from-top-1"
          >
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                STATUS_TONE_CLASS[entry.tone],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {entry.href ? (
                <Link
                  to={entry.href}
                  className="text-sm leading-snug break-words hover:text-primary hover:underline underline-offset-4"
                >
                  {entry.text}
                </Link>
              ) : (
                <span className="text-sm leading-snug break-words">
                  {entry.text}
                </span>
              )}
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <time
                  dateTime={entry.createdAt}
                  title={formatDateTime(entry.createdAt)}
                >
                  {activityTimeLabel(entry.createdAt, now)}
                </time>
                {!compact && entry.category ? (
                  <span className={STATUS_TONE_TEXT_CLASS.muted}>
                    · {ACTIVITY_CATEGORY_LABELS[entry.category]}
                  </span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

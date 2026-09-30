// 工作台的指标卡：大数字 + 分项（小圆点着色）+ 跳转。加载中按同样的网格出骨架。

import {
  AlertTriangle,
  Bot,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  STATUS_TONE_DOT_CLASS,
  STATUS_TONE_TEXT_CLASS,
} from "@/lib/status-tone";
import { cn } from "@/lib/utils";

import type { StatCard, StatCardKey } from "./dashboard-cards";

const ICONS: Readonly<Record<StatCardKey, typeof Bot>> = {
  accounts: UserRound,
  groups: UsersRound,
  messages: MessageSquare,
  agentRuns: Bot,
  sequences: CalendarClock,
  inconsistencies: AlertTriangle,
};

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

export function DashboardStatCardsView({
  cards,
  loading,
}: {
  cards: StatCard[];
  loading: boolean;
}) {
  if (loading && cards.length === 0)
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="gap-3 px-5 py-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-full" />
          </Card>
        ))}
      </div>
    );

  return (
    <div className={GRID} data-testid="dashboard-stats">
      {cards.map((card) => {
        const Icon = ICONS[card.key];

        return (
          <Link
            key={card.key}
            to={card.href}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full gap-3 px-5 py-5 transition-shadow group-hover:shadow-md group-hover:ring-primary/25">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  {card.title}
                </span>
                <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "text-3xl font-semibold tracking-tight tabular-nums",
                    card.tone === "neutral" || card.tone === "muted"
                      ? "text-foreground"
                      : STATUS_TONE_TEXT_CLASS[card.tone],
                  )}
                >
                  {card.value}
                </span>
                <span className="text-sm text-muted-foreground">
                  {card.caption}
                </span>
              </div>
              {card.breakdown.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {card.breakdown.map((item) => (
                    <li key={item.label} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_TONE_DOT_CLASS[item.tone],
                        )}
                      />
                      {item.label}
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          item.tone === "danger"
                            ? STATUS_TONE_TEXT_CLASS.danger
                            : "text-foreground",
                        )}
                      >
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {card.value > 0
                    ? "点这里去异常中心逐条处理"
                    : "没有待处理的异常"}
                </p>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

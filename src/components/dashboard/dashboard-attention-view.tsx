// 「需要处理」卡片：被拦下的运行、失败 / 状态未知的消息、今日失败的任务、未处理异常 —— 每条可点进对应页（带筛选）。

import { CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { cn } from "@/lib/utils";

import { type AttentionItem, pendingAttention } from "./dashboard-cards";

export function DashboardAttentionView({
  items,
  loading,
  className,
}: {
  items: AttentionItem[];
  loading: boolean;
  className?: string;
}) {
  const pending = pendingAttention(items);

  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle>需要处理</CardTitle>
        <CardDescription>
          {loading && items.length === 0
            ? "正在汇总…"
            : pending > 0
              ? `有 ${pending} 类情况需要人看一眼`
              : "目前一切正常"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {loading && items.length === 0 ? (
          <div className="flex flex-col gap-2 px-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col" data-testid="dashboard-attention">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                  {item.count > 0 ? (
                    <StatusBadge tone={item.tone}>{item.count}</StatusBadge>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-success" />无
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

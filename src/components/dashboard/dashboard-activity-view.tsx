// 工作台的「实时动态」卡片：首屏 20 条，之后推送逐条插到顶部（最多 50 条）。

import { Radio } from "lucide-react";
import { Link } from "react-router";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityList } from "@/components/ui-atoms/activity-list";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import type { DashboardActivityViewProps } from "./types";

export function DashboardActivityView({
  entries,
  now,
  loading,
  error,
  retrying,
  onRetry,
  className,
}: DashboardActivityViewProps & { className?: string }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          实时动态
        </CardTitle>
        <CardDescription>
          账号、消息、Agent、序列与异常的最新变化
        </CardDescription>
        <CardAction>
          <Link to="/activity" className="text-sm text-primary hover:underline">
            查看全部
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error && entries.length === 0 ? (
          <QueryError
            title="动态加载失败"
            message={getErrorMessage(error)}
            retrying={retrying}
            onRetry={onRetry}
          />
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            还没有动态：连接账号、建群或发一条消息试试。
          </p>
        ) : (
          <ScrollArea
            className="h-[26rem] pr-3"
            data-testid="dashboard-activity"
          >
            <ActivityList entries={entries} now={now} compact />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

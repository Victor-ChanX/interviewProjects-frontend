// view：实时动态（全屏版）。类型页签 + 动态列表（新的推送从顶部插入）+ 「加载更早」。纯展示。

import { Radio, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityList } from "@/components/ui-atoms/activity-list";
import { FilterTabs } from "@/components/ui-atoms/filter-tabs";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import type { ActivityFeedViewProps } from "./types";

export function ActivityFeedView({
  type,
  typeOptions,
  onTypeChange,
  entries,
  total,
  now,
  loading,
  error,
  retrying,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
}: ActivityFeedViewProps) {
  return (
    <>
      <PageHeader
        title="实时动态"
        description="平台上发生的每一件事：账号状态、消息投递、Agent 运行、定时序列、群变化与异常。新的动态实时插到最上面。"
        actions={
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={cn({ "animate-spin": retrying })} />
            刷新
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterTabs
              aria-label="按类型筛选"
              value={type}
              onValueChange={onTypeChange}
              options={typeOptions}
            />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="size-3.5 text-success" />
              已加载 {total} 条
            </span>
          </div>

          {error && total === 0 ? (
            <QueryError
              title="动态加载失败"
              message={getErrorMessage(error)}
              retrying={retrying}
              onRetry={onRetry}
            />
          ) : loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {total === 0
                ? "还没有动态"
                : "已加载的动态里没有这一类，点「加载更早」往前翻"}
            </p>
          ) : (
            <ActivityList entries={entries} now={now} />
          )}

          {hasMore ? (
            <Button
              variant="outline"
              className="self-center"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "加载中…" : "加载更早"}
            </Button>
          ) : total > 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              没有更早的动态了
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

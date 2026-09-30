// view：纯展示，props 进回调出。不 fetch、不 toast、不做路由、不碰 storage。

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date";

import type { ExampleListViewProps } from "./types";

export function ExampleListView({
  items,
  loading,
  error,
  retrying,
  filters,
  connection,
  onFiltersChange,
  onRetry,
  onOpen,
}: ExampleListViewProps) {
  return (
    <section className="flex flex-col gap-4">
      <form
        noValidate
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <input
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="搜索名称"
          value={filters.keyword}
          onChange={(event) =>
            onFiltersChange({ ...filters, keyword: event.target.value })
          }
        />
        <span className="text-xs text-muted-foreground">
          {connection === "open" ? "实时" : "离线"}
        </span>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm">
          <p className="text-destructive">加载失败</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw className="size-4" />
            重试
          </Button>
        </div>
      ) : loading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无数据</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <button
                type="button"
                className="text-left text-sm text-foreground hover:underline"
                onClick={() => onOpen(item.id)}
              >
                {item.name}
              </button>
              <time className="text-xs text-muted-foreground">
                {formatDateTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

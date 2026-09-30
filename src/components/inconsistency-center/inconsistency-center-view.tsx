// view：异常中心。未处理 / 已处理页签 + DataTable（类型 / 引用 / 说明 / 时间 / 处理人）；点一行在右侧抽屉里看
// payload 原文；admin 行尾与抽屉底部都有「标记已处理」。纯展示。

import { CheckCheck, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { FilterTabs } from "@/components/ui-atoms/filter-tabs";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  describeInconsistencyKind,
  INCONSISTENCY_TAB_LABELS,
  type InconsistencyTab,
} from "@/lib/inconsistency-labels";
import { cn } from "@/lib/utils";
import type { InconsistencyRead } from "@/services/inconsistency-service";

import { InconsistencyDetailSheetView } from "./inconsistency-detail-sheet-view";
import type { InconsistencyCenterViewProps } from "./types";

const col = dataTableColumnHelper<InconsistencyRead>();

const Dash = () => <span className="text-muted-foreground">-</span>;

function buildColumns(
  tab: InconsistencyTab,
  canResolve: boolean,
  resolvingId: string | null,
  onResolve: (id: string) => void,
) {
  return col.columns([
    col.accessor("kind", {
      header: "类型",
      meta: { label: "类型", className: "w-44" },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge tone={tab === "open" ? "danger" : "muted"}>
            {describeInconsistencyKind(row.original.kind)}
          </StatusBadge>
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.original.kind}
          </span>
        </div>
      ),
    }),
    col.accessor("ref", {
      header: "引用",
      meta: { label: "引用", className: "w-40" },
      cell: ({ row }) =>
        row.original.ref ? (
          <span className="font-mono text-xs" title={row.original.ref}>
            {row.original.ref}
          </span>
        ) : (
          <Dash />
        ),
    }),
    col.accessor("message", {
      header: "说明",
      meta: { label: "说明", className: "min-w-64 whitespace-normal" },
      cell: ({ row }) => (
        <span className="line-clamp-2 break-words">{row.original.message}</span>
      ),
    }),
    col.accessor("createdAt", {
      header: "时间",
      meta: { label: "时间", className: "w-36" },
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt}>
          {formatDateTime(row.original.createdAt)}
        </time>
      ),
    }),
    col.accessor("resolvedBy", {
      header: "处理",
      meta: { label: "处理人 / 时间", className: "w-40" },
      cell: ({ row }) =>
        row.original.resolvedAt ? (
          <div className="flex flex-col text-xs">
            <span>{row.original.resolvedBy ?? "-"}</span>
            <span className="text-muted-foreground">
              {formatDateTime(row.original.resolvedAt)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">未处理</span>
        ),
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      meta: { className: "w-32 text-right" },
      cell: ({ row }) =>
        canResolve && !row.original.resolvedAt ? (
          <Button
            size="sm"
            variant="outline"
            disabled={resolvingId === row.original.id}
            onClick={(event) => {
              event.stopPropagation();
              onResolve(row.original.id);
            }}
          >
            <CheckCheck />
            标记已处理
          </Button>
        ) : null,
    }),
  ]);
}

export function InconsistencyCenterView({
  tab,
  onTabChange,
  unresolvedCount,
  items,
  loading,
  error,
  retrying,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
  canResolve,
  onResolve,
  resolvingId,
  sheet,
}: InconsistencyCenterViewProps) {
  const columns = useMemo(
    () => buildColumns(tab, canResolve, resolvingId, onResolve),
    [canResolve, onResolve, resolvingId, tab],
  );

  return (
    <>
      <PageHeader
        title="异常中心"
        description="系统自己对不上账的地方：未知群的消息、处理失败的入站事件、退群对账不一致。事件流不会因此中断，但需要人看一眼。"
        actions={
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={cn({ "animate-spin": retrying })} />
            刷新
          </Button>
        }
      />

      {error ? (
        <QueryError
          title="异常列表加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={items}
              getRowId={(item) => item.id}
              loading={loading}
              emptyTitle={
                tab === "open" ? "没有未处理的异常" : "还没有处理过的异常"
              }
              emptyDescription={
                tab === "open"
                  ? "一切正常；新的异常会实时出现在这里。"
                  : undefined
              }
              onRowClick={(item) => onOpen(item.id)}
              toolbar={
                <FilterTabs
                  aria-label="处理状态"
                  value={tab}
                  onValueChange={onTabChange}
                  options={[
                    {
                      value: "open",
                      label: INCONSISTENCY_TAB_LABELS.open,
                      count: unresolvedCount,
                    },
                    {
                      value: "resolved",
                      label: INCONSISTENCY_TAB_LABELS.resolved,
                    },
                  ]}
                />
              }
              footer={
                hasMore ? (
                  <Button
                    variant="outline"
                    className="self-center"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "加载中…" : "加载更多"}
                  </Button>
                ) : null
              }
              testId="inconsistency-table"
            />
          </CardContent>
        </Card>
      )}

      <InconsistencyDetailSheetView {...sheet} />
    </>
  );
}

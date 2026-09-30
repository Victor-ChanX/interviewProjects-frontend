// view：Agent 运行（全部群）。状态页签 + 按群筛选 + DataTable（运行 / 群 / 状态 / 结束原因 / 步数 / 时间 / 摘要），
// 被拦下的整行标红；点一行进运行详情；底部「加载更多」。纯展示。

import { RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { FilterTabs } from "@/components/ui-atoms/filter-tabs";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import {
  AGENT_RUN_STATUS_FILTERS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STATUS_TONE,
} from "@/lib/agent-run-labels";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { shortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";

import type { AgentRunListViewProps, AgentRunRow } from "./types";

const col = dataTableColumnHelper<AgentRunRow>();

const Dash = () => <span className="text-muted-foreground">-</span>;

const stop = (event: { stopPropagation: () => void }) =>
  event.stopPropagation();

const COLUMNS = col.columns([
  col.accessor("id", {
    header: "运行",
    meta: { label: "运行", className: "w-32" },
    cell: ({ row }) => (
      <Link
        to={`/agent-runs/${encodeURIComponent(row.original.id)}`}
        className="font-mono text-xs font-medium text-primary hover:underline"
        title={row.original.id}
        onClick={stop}
      >
        {shortId(row.original.id)}
      </Link>
    ),
  }),
  col.accessor("groupName", {
    header: "群",
    meta: { label: "群", className: "w-40" },
    cell: ({ row }) => (
      <Link
        to={`/groups/${encodeURIComponent(row.original.groupId)}?tab=runs`}
        className="font-mono text-xs hover:text-primary hover:underline"
        onClick={stop}
      >
        {row.original.groupName}
      </Link>
    ),
  }),
  col.accessor("status", {
    header: "状态",
    meta: { label: "状态", className: "w-28" },
    cell: ({ row }) => (
      <StatusBadge
        tone={AGENT_RUN_STATUS_TONE[row.original.status]}
        pulse={row.original.status === "running"}
      >
        {AGENT_RUN_STATUS_LABELS[row.original.status]}
      </StatusBadge>
    ),
  }),
  col.accessor("endReasonLabel", {
    header: "结束原因",
    meta: { label: "结束原因", className: "w-28" },
    cell: ({ row }) => row.original.endReasonLabel ?? <Dash />,
  }),
  col.accessor("stepCount", {
    header: "步数",
    meta: { label: "步数", className: "w-16 text-right tabular-nums" },
  }),
  col.accessor("createdAt", {
    header: "开始",
    meta: { label: "开始时间", className: "w-36" },
    cell: ({ row }) => (
      <time dateTime={row.original.createdAt}>
        {formatDateTime(row.original.createdAt)}
      </time>
    ),
  }),
  col.accessor("finishedAt", {
    header: "结束",
    meta: { label: "结束时间", className: "w-36" },
    cell: ({ row }) =>
      row.original.finishedAt ? (
        <time dateTime={row.original.finishedAt}>
          {formatDateTime(row.original.finishedAt)}
        </time>
      ) : (
        <Dash />
      ),
  }),
  col.accessor("summary", {
    header: "摘要",
    meta: { label: "摘要", className: "max-w-xs" },
    cell: ({ row }) =>
      row.original.summary ? (
        <span className="block truncate" title={row.original.summary}>
          {row.original.summary}
        </span>
      ) : (
        <Dash />
      ),
  }),
]);

export function AgentRunListView({
  status,
  onStatusChange,
  group,
  onGroupChange,
  groupOptions,
  rows,
  loading,
  error,
  retrying,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  onOpen,
}: AgentRunListViewProps) {
  return (
    <>
      <PageHeader
        title="Agent 运行"
        description="所有群里 AI 群助手的每一次运行：外部成员发言触发，逐步调用工具，每一步都经过审计。"
        actions={
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={cn({ "animate-spin": retrying })} />
            刷新
          </Button>
        }
      />

      {error ? (
        <QueryError
          title="Agent 运行加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={COLUMNS}
              data={rows}
              getRowId={(row) => row.id}
              loading={loading}
              emptyTitle="没有符合条件的运行"
              emptyDescription="换一个状态或群试试；群详情里打开「Agent 自动回复」后，外部成员发言就会触发运行。"
              onRowClick={(row) => onOpen(row.id)}
              rowClassName={(row) =>
                row.status === "blocked"
                  ? "bg-destructive/8 hover:bg-destructive/12"
                  : undefined
              }
              initialHiddenColumns={["finishedAt"]}
              toolbar={
                <>
                  <FilterTabs
                    aria-label="按状态筛选"
                    value={status}
                    onValueChange={onStatusChange}
                    options={AGENT_RUN_STATUS_FILTERS.map((value) => ({
                      value,
                      label:
                        value === "all"
                          ? "全部"
                          : AGENT_RUN_STATUS_LABELS[value],
                    }))}
                  />
                  <Select
                    value={group}
                    onValueChange={(value) => onGroupChange(value ?? "")}
                    items={[{ value: "", label: "全部群" }, ...groupOptions]}
                  >
                    <SelectTrigger aria-label="按群筛选" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部群</SelectItem>
                      {groupOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="font-mono">{option.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
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
                ) : rows.length > 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    已经到底了
                  </p>
                ) : null
              }
              testId="agent-run-table"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

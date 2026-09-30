// view：群组管理。标题行（刷新 / 新建群）+ DataTable（群 / 状态 / 成员数 / 群主 / Agent / 进行中）。
// 整行可点进群详情，群名本身也是链接（键盘可达）。纯展示，props 进回调出。

import { Bot, CalendarClock, Plus, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { getErrorMessage } from "@/lib/get-error-message";
import { GROUP_STATUS_LABELS, GROUP_STATUS_TONE } from "@/lib/group-labels";
import { groupDisplayName, shortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";
import type { GroupRead } from "@/services/group-service";

import { CreateGroupDialogView } from "./create-group-dialog-view";
import type { GroupListViewProps } from "./types";

const col = dataTableColumnHelper<GroupRead>();

const Dash = () => <span className="text-muted-foreground">-</span>;

const COLUMNS = col.columns([
  col.accessor("gatewayGroupId", {
    id: "name",
    header: "群",
    meta: { label: "群", className: "min-w-44" },
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <Link
          to={`/groups/${encodeURIComponent(row.original.id)}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {groupDisplayName(row.original)}
        </Link>
        <span
          className="font-mono text-xs text-muted-foreground"
          title={row.original.id}
        >
          {shortId(row.original.id)}
        </span>
      </div>
    ),
  }),
  col.accessor("status", {
    header: "状态",
    meta: { label: "状态", className: "w-28" },
    cell: ({ row }) => (
      <StatusBadge tone={GROUP_STATUS_TONE[row.original.status]}>
        {GROUP_STATUS_LABELS[row.original.status]}
      </StatusBadge>
    ),
  }),
  col.accessor((group) => group.members.length, {
    id: "members",
    header: "成员数",
    meta: { label: "成员数", className: "w-20 text-right tabular-nums" },
  }),
  col.accessor("creatorAccountId", {
    header: "群主",
    meta: { label: "群主", className: "w-28" },
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.creatorAccountId}</span>
    ),
  }),
  col.accessor("agentEnabled", {
    header: "Agent",
    meta: { label: "Agent 开关", className: "w-24" },
    cell: ({ row }) =>
      row.original.agentEnabled ? (
        <StatusBadge tone="info">开启</StatusBadge>
      ) : (
        <StatusBadge tone="muted">关闭</StatusBadge>
      ),
  }),
  col.display({
    id: "active",
    header: "进行中",
    meta: { label: "进行中的运行 / 序列", className: "min-w-40" },
    cell: ({ row }) => {
      const { activeAgentRunId, activeSequenceRunId } = row.original;

      if (!activeAgentRunId && !activeSequenceRunId) return <Dash />;

      return (
        <div className="flex flex-wrap gap-1.5">
          {activeAgentRunId ? (
            <StatusBadge tone="info" pulse dot title={activeAgentRunId}>
              <Bot className="size-3" />
              Agent 运行
            </StatusBadge>
          ) : null}
          {activeSequenceRunId ? (
            <StatusBadge tone="info" pulse title={activeSequenceRunId}>
              <CalendarClock className="size-3" />
              序列
            </StatusBadge>
          ) : null}
        </div>
      );
    },
  }),
]);

export function GroupListView({
  groups,
  loading,
  error,
  retrying,
  onRetry,
  onOpen,
  createDialog,
  onCreate,
}: GroupListViewProps) {
  const activeCount = useMemo(
    () => groups.filter((group) => group.status === "active").length,
    [groups],
  );

  return (
    <>
      <PageHeader
        title="群组管理"
        description={`服务账号所在的群（共 ${groups.length} 个，正常 ${activeCount} 个）；点一行进入群详情看消息、成员与 Agent 运行。`}
        actions={
          <>
            <Button variant="outline" onClick={onRetry} disabled={retrying}>
              <RefreshCw className={cn({ "animate-spin": retrying })} />
              刷新
            </Button>
            {createDialog ? (
              <Button onClick={onCreate}>
                <Plus />
                新建群
              </Button>
            ) : null}
          </>
        }
      />

      {createDialog ? <CreateGroupDialogView {...createDialog} /> : null}

      {error ? (
        <QueryError
          title="群列表加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      ) : (
        <Card>
          <CardContent>
            <DataTable
              columns={COLUMNS}
              data={groups}
              getRowId={(group) => group.id}
              loading={loading}
              emptyTitle="暂无群"
              emptyDescription={
                createDialog
                  ? "点右上角「新建群」，用在线的服务账号建一个。"
                  : undefined
              }
              onRowClick={(group) => onOpen(group.id)}
              rowClassName={(group) =>
                group.status === "left" ? "text-muted-foreground" : undefined
              }
              testId="group-table"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

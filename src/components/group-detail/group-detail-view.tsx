// 群详情：纯展示，props 进回调出。顶部信息卡（状态 / 网关群 ID / 群主 / 开关 / 全部退群 / 序列运行）
// + 页签（消息时间线与发送框 / 成员 / Agent 运行 / 序列）。页签面板 keepMounted：切走再切回来，
// 发送框里没发出去的字不丢（frontend-component-splitting「页签面板里有表单时用 hidden」）。

import { CalendarClock, LogOut } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { getErrorMessage } from "@/lib/get-error-message";
import { GROUP_STATUS_LABELS, GROUP_STATUS_TONE } from "@/lib/group-labels";
import { groupDisplayName, shortId } from "@/lib/short-id";
import type { GroupStatus } from "@/services/group-service";

import { AgentRunListView } from "./agent-run-list-view";
import { GroupInfoCardView } from "./group-info-card-view";
import { GroupSequenceTabView } from "./group-sequence-tab-view";
import { GROUP_TAB_LABELS, GROUP_TABS, type GroupTab } from "./group-tabs";
import { LeaveAllDialogView } from "./leave-all-dialog-view";
import { MemberTableView } from "./member-table-view";
import { MessageTimelineView } from "./message-timeline-view";
import { SendMessageFormView } from "./send-message-form-view";
import type { GroupDetailViewProps } from "./types";

/** 全部退群只对还在群里的状态开放（left 后端回 409 GROUP_ALREADY_LEFT）。 */
const CAN_LEAVE_ALL: Readonly<Record<GroupStatus, boolean>> = {
  active: true,
  unreachable: true,
  left: false,
};

export function GroupDetailView({
  group,
  loading,
  error,
  retrying,
  onRetry,
  tab,
  onTabChange,
  canWrite,
  savingSetting,
  onToggleSetting,
  members,
  timeline,
  sendForm,
  agentRuns,
  leaveAll,
  onLeaveAll,
}: GroupDetailViewProps) {
  if (error)
    return (
      <QueryError
        title="群详情加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !group)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );

  const counts: Partial<Record<GroupTab, number>> = {
    members: members.members.length,
    runs: agentRuns.runs.length,
  };
  const sequenceHref = `/groups/${encodeURIComponent(group.id)}/sequences`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{groupDisplayName(group)}</span>
            <StatusBadge tone={GROUP_STATUS_TONE[group.status]}>
              {GROUP_STATUS_LABELS[group.status]}
            </StatusBadge>
          </span>
        }
        description={
          <>
            本地 ID <span className="font-mono">{shortId(group.id)}</span> ·
            群主 <span className="font-mono">{group.creatorAccountId}</span> ·{" "}
            {group.members.length} 名成员
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link to={sequenceHref} />}
              nativeButton={false}
            >
              <CalendarClock />
              序列运行
            </Button>
            {leaveAll && CAN_LEAVE_ALL[group.status] ? (
              <Button variant="destructive" onClick={onLeaveAll}>
                <LogOut />
                全部退群
              </Button>
            ) : null}
          </>
        }
      />

      {leaveAll ? <LeaveAllDialogView {...leaveAll} /> : null}

      <GroupInfoCardView
        group={group}
        canWrite={canWrite}
        savingSetting={savingSetting}
        onToggleSetting={onToggleSetting}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => onTabChange(next as GroupTab)}
        className="gap-4"
      >
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <TabsList
            variant="line"
            className="h-10 gap-4 border-b border-border px-0"
          >
            {GROUP_TABS.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none px-1 pb-2"
              >
                {GROUP_TAB_LABELS[value]}
                {counts[value] !== undefined ? (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                    {counts[value]}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="messages" keepMounted>
          <Card className="gap-0 py-0">
            <CardContent className="px-0">
              <MessageTimelineView {...timeline} />
            </CardContent>
            {sendForm ? (
              <div className="border-t border-border bg-muted/30 p-4">
                <SendMessageFormView {...sendForm} />
              </div>
            ) : (
              <p className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                只读账号：可以查看消息，不能发送。
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="members" keepMounted>
          <MemberTableView {...members} />
        </TabsContent>

        <TabsContent value="runs" keepMounted>
          <AgentRunListView {...agentRuns} />
        </TabsContent>

        <TabsContent value="sequences" keepMounted>
          <GroupSequenceTabView
            activeSequenceRunId={group.activeSequenceRunId}
            sequenceHref={sequenceHref}
            canWrite={canWrite}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

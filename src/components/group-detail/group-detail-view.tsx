// 群详情的布局：纯展示，props 进回调出。头部（状态 / 开关 / 进行中的 run）+ 成员表 + 时间线（含发消息表单）
// + agent run 列表。不 fetch、不 toast、不做路由、不知道有实时连接（connection 只是一个要显示的状态）。

import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type { GroupStatus } from "@/services/group-service";

import { AgentRunListView } from "./agent-run-list-view";
import { MemberTableView } from "./member-table-view";
import { MessageTimelineView } from "./message-timeline-view";
import { SendMessageFormView } from "./send-message-form-view";
import type { GroupDetailViewProps, GroupSetting } from "./types";

const STATUS_LABELS: Readonly<Record<GroupStatus, string>> = {
  active: "正常",
  unreachable: "不可达",
  left: "已退群",
};

/** 群状态 → 徽标样式，走主题 token。 */
const STATUS_CLASS: Readonly<Record<GroupStatus, string>> = {
  active: "border-success/40 bg-success/15 text-success",
  unreachable: "border-destructive/40 bg-destructive/15 text-destructive",
  left: "border-border bg-muted text-muted-foreground",
};

const SETTING_LABELS: Readonly<Record<GroupSetting, string>> = {
  agentEnabled: "Agent 自动回复",
  autoKickEnabled: "自动踢人",
};

function SettingSwitch({
  setting,
  checked,
  saving,
  onChange,
}: {
  setting: GroupSetting;
  checked: boolean;
  saving: boolean;
  onChange: (setting: GroupSetting, value: boolean) => void;
}) {
  const id = `group-setting-${setting}`;

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="size-4 accent-primary"
        checked={checked}
        disabled={saving}
        onChange={(event) => onChange(setting, event.target.checked)}
      />
      <Label htmlFor={id} className={cn({ "opacity-60": saving })}>
        {SETTING_LABELS[setting]}
        {saving ? "（保存中…）" : null}
      </Label>
    </div>
  );
}

export function GroupDetailView({
  group,
  loading,
  error,
  retrying,
  onRetry,
  connection,
  canWrite,
  savingSetting,
  onToggleSetting,
  members,
  timeline,
  sendForm,
  agentRuns,
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
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-md bg-muted" />
      </div>
    );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/groups"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 群列表
          </Link>
          <h1 className="font-mono text-lg font-semibold">{group.id}</h1>
          <Badge
            variant="outline"
            className={cn("font-medium", STATUS_CLASS[group.status])}
          >
            {STATUS_LABELS[group.status]}
          </Badge>
          <span
            className={cn("text-xs", {
              "text-success": connection === "open",
              "text-muted-foreground": connection !== "open",
            })}
          >
            {connection === "open" ? "实时" : "离线"}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">网关群 ID</dt>
            <dd className="font-mono text-xs">{group.gatewayGroupId ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">群主账号</dt>
            <dd className="font-mono text-xs">{group.creatorAccountId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">进行中的 agent run</dt>
            <dd className="font-mono text-xs">
              {group.activeAgentRunId ?? (
                <span className="font-sans text-muted-foreground">无</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">进行中的序列</dt>
            <dd className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {group.activeSequenceRunId ?? (
                <span className="font-sans text-muted-foreground">无</span>
              )}
              {/* 前端 #6：序列运行页（预检弹窗 / 启动 / 进度）。 */}
              <Link
                to={`/groups/${encodeURIComponent(group.id)}/sequences`}
                className="font-sans underline-offset-4 hover:underline"
              >
                {group.activeSequenceRunId ? "查看进度 →" : "序列运行 →"}
              </Link>
            </dd>
          </div>
        </dl>
        {canWrite ? (
          <div className="flex flex-wrap gap-6">
            <SettingSwitch
              setting="agentEnabled"
              checked={group.agentEnabled}
              saving={savingSetting === "agentEnabled"}
              onChange={onToggleSetting}
            />
            <SettingSwitch
              setting="autoKickEnabled"
              checked={group.autoKickEnabled}
              saving={savingSetting === "autoKickEnabled"}
              onChange={onToggleSetting}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {SETTING_LABELS.agentEnabled}：{group.agentEnabled ? "开" : "关"} ·{" "}
            {SETTING_LABELS.autoKickEnabled}：
            {group.autoKickEnabled ? "开" : "关"}
          </p>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>成员</CardTitle>
          <CardDescription>共 {members.members.length} 人</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTableView {...members} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>消息</CardTitle>
          <CardDescription>最新在下；自己发的消息带投递状态</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MessageTimelineView {...timeline} />
          {sendForm ? (
            <div className="border-t border-border pt-4">
              <SendMessageFormView {...sendForm} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent run</CardTitle>
          <CardDescription>最新在前</CardDescription>
        </CardHeader>
        <CardContent>
          <AgentRunListView {...agentRuns} />
        </CardContent>
      </Card>
    </section>
  );
}

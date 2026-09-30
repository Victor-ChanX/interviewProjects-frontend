// 群详情的信息卡：状态、网关群 ID、群主、进行中的 Agent 运行 / 序列，以及两个开关（admin 可切，viewer 只看）。

import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { GROUP_STATUS_LABELS, GROUP_STATUS_TONE } from "@/lib/group-labels";
import { shortId } from "@/lib/short-id";
import type { GroupRead } from "@/services/group-service";

import type { GroupSetting } from "./types";

const SETTINGS: readonly { key: GroupSetting; label: string; hint: string }[] =
  [
    {
      key: "agentEnabled",
      label: "Agent 自动回复",
      hint: "外部成员发言时触发 AI 群助手",
    },
    {
      key: "autoKickEnabled",
      label: "自动踢人",
      hint: "允许 Agent 把违规成员移出群",
    },
  ];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-all">{children}</dd>
    </div>
  );
}

export function GroupInfoCardView({
  group,
  canWrite,
  savingSetting,
  onToggleSetting,
}: {
  group: GroupRead;
  canWrite: boolean;
  savingSetting: GroupSetting | null;
  onToggleSetting: (setting: GroupSetting, value: boolean) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
          <Field label="状态">
            <StatusBadge tone={GROUP_STATUS_TONE[group.status]}>
              {GROUP_STATUS_LABELS[group.status]}
            </StatusBadge>
          </Field>
          <Field label="网关群 ID">
            <span className="font-mono text-xs">
              {group.gatewayGroupId ?? "-"}
            </span>
          </Field>
          <Field label="群主账号">
            <span className="font-mono text-xs">{group.creatorAccountId}</span>
          </Field>
          <Field label="成员数">
            <span className="tabular-nums">{group.members.length}</span>
          </Field>
          <Field label="进行中的 Agent 运行">
            {group.activeAgentRunId ? (
              <Link
                to={`/agent-runs/${encodeURIComponent(group.activeAgentRunId)}`}
                className="font-mono text-xs text-primary hover:underline"
                title={group.activeAgentRunId}
              >
                {shortId(group.activeAgentRunId)}
              </Link>
            ) : (
              <span className="text-muted-foreground">无</span>
            )}
          </Field>
          <Field label="进行中的序列">
            {group.activeSequenceRunId ? (
              <Link
                to={`/groups/${encodeURIComponent(group.id)}/sequences`}
                className="font-mono text-xs text-primary hover:underline"
                title={group.activeSequenceRunId}
              >
                {shortId(group.activeSequenceRunId)}（查看进度）
              </Link>
            ) : (
              <span className="text-muted-foreground">无</span>
            )}
          </Field>
        </dl>
        <Separator />
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {SETTINGS.map((setting) => {
            const id = `group-setting-${setting.key}`;
            const saving = savingSetting === setting.key;

            return (
              <div key={setting.key} className="flex items-center gap-3">
                {/* viewer 不出现开关（写操作 403），只显示当前是开是关。 */}
                {canWrite ? (
                  <Switch
                    id={id}
                    aria-label={setting.label}
                    checked={group[setting.key]}
                    disabled={saving}
                    onCheckedChange={(value) =>
                      onToggleSetting(setting.key, value)
                    }
                  />
                ) : (
                  <StatusBadge tone={group[setting.key] ? "info" : "muted"}>
                    {group[setting.key] ? "开启" : "关闭"}
                  </StatusBadge>
                )}
                <div className="flex flex-col">
                  <Label
                    htmlFor={canWrite ? id : undefined}
                    className="text-sm"
                  >
                    {setting.label}
                    {saving ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        保存中…
                      </span>
                    ) : null}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {canWrite ? setting.hint : "只读"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

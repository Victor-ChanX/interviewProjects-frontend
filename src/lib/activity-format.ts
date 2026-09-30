// 「实时动态」一条事件 → 一句中文描述（前端 #12）。工作台的动态卡片与实时动态页共用；事件本身是后端 WS 帧
// { seq, type, payload }（GET /api/activity 同形，多一个 createdAt），payload 形状见后端 src/services/ws-events.ts
// 各写入方。payload 在 openapi 里是自由 record，所以这里按字段逐个读、读不到就不说，不因为一个坏字段整条丢掉。
//
// 群在句子里用网关群 ID（人工测试手册、模拟器命令都用它）：事件只带本地 groupId，调用方传一个
// groupName(groupId) 从群列表缓存里查，查不到退回缩写的 id。

import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
} from "@/lib/account-labels";
import type { AccountStatus } from "@/lib/account-transitions";
import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STATUS_TONE,
} from "@/lib/agent-run-labels";
import { formatRelativeTime } from "@/lib/format-date";
import { GROUP_STATUS_LABELS, GROUP_STATUS_TONE } from "@/lib/group-labels";
import { describeInconsistencyKind } from "@/lib/inconsistency-labels";
import { describeJobStep, JOB_KIND_LABELS } from "@/lib/job-labels";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
} from "@/lib/message-labels";
import { shortId } from "@/lib/short-id";
import type { StatusTone } from "@/lib/status-tone";
import type { components } from "@/types/api.generated";

type Schemas = components["schemas"];

export type ActivityCategory =
  | "account"
  | "message"
  | "agent"
  | "sequence"
  | "group"
  | "job"
  | "inconsistency";

export const ACTIVITY_CATEGORY_LABELS: Readonly<
  Record<ActivityCategory, string>
> = {
  account: "账号",
  message: "消息",
  agent: "Agent",
  sequence: "序列",
  group: "群组",
  job: "任务",
  inconsistency: "异常",
};

/** 实时动态页的类型筛选顺序。 */
export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = Object.freeze([
  "account",
  "message",
  "agent",
  "sequence",
  "group",
  "job",
  "inconsistency",
]);

const CATEGORY_BY_TYPE: Readonly<Record<string, ActivityCategory>> = {
  account_status_changed: "account",
  account_terminal: "account",
  message: "message",
  agent_run: "agent",
  sequence_run: "sequence",
  member_changed: "group",
  group_status_changed: "group",
  group_settings_changed: "group",
  job: "job",
  inconsistency: "inconsistency",
};

/** 事件 type → 分类；不认识的 type（后端新加的）为 null，页面照样显示、只是不进任何筛选。 */
export function activityCategory(type: string): ActivityCategory | null {
  return Object.hasOwn(CATEGORY_BY_TYPE, type) ? CATEGORY_BY_TYPE[type] : null;
}

export interface ActivityInput {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FormattedActivity {
  key: string;
  category: ActivityCategory | null;
  tone: StatusTone;
  text: string;
  /** 点这一条去哪儿看；没有合适的页面为 null。 */
  href: string | null;
  createdAt: string;
}

export interface ActivityContext {
  /** groupId → 界面上的群名（网关群 ID）；查不到返回 null 走缩写。 */
  groupName?: (groupId: string) => string | null;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];

  return typeof value === "string" && value !== "" ? value : null;
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];

  return typeof value === "boolean" ? value : null;
}

function pick<K extends string>(
  table: Readonly<Record<K, string>>,
  value: string | null,
): K | null {
  return value !== null && Object.hasOwn(table, value) ? (value as K) : null;
}

function groupHref(groupId: string | null): string | null {
  return groupId ? `/groups/${encodeURIComponent(groupId)}` : null;
}

type Described = Pick<FormattedActivity, "tone" | "text" | "href">;

function describe(
  item: ActivityInput,
  groupLabel: (groupId: string | null) => string,
): Described {
  const p = item.payload;
  const groupId = str(p, "groupId");
  const group = groupLabel(groupId);

  switch (item.type) {
    case "account_status_changed": {
      const account = str(p, "accountId") ?? "账号";
      const from = pick<AccountStatus>(ACCOUNT_STATUS_LABELS, str(p, "from"));
      const to = pick<AccountStatus>(ACCOUNT_STATUS_LABELS, str(p, "to"));

      return {
        tone: to ? ACCOUNT_STATUS_TONE[to] : "neutral",
        text: `${account} 状态变化：${from ? ACCOUNT_STATUS_LABELS[from] : "?"} → ${to ? ACCOUNT_STATUS_LABELS[to] : "?"}`,
        href: "/accounts",
      };
    }

    case "account_terminal": {
      const account = str(p, "accountId") ?? "账号";
      const status = str(p, "status");

      return {
        tone: "danger",
        text:
          status === "session_expired"
            ? `${account} 会话失效（终态）`
            : `${account} 被平台停用`,
        href: "/accounts",
      };
    }

    case "message": {
      const delivery = pick<Schemas["DeliveryStatus"]>(
        DELIVERY_STATUS_LABELS,
        str(p, "deliveryStatus"),
      );
      const failCode = str(p, "failCode");

      if (delivery)
        return {
          tone: DELIVERY_STATUS_TONE[delivery],
          text: `群 ${group} 的出站消息${DELIVERY_STATUS_LABELS[delivery]}${failCode && (delivery === "failed" || delivery === "cancelled") ? `（${failCode}）` : ""}`,
          href: groupHref(groupId),
        };

      return bool(p, "isOwn")
        ? {
            tone: "muted",
            text: `群 ${group} 收到自己发出消息的回流`,
            href: groupHref(groupId),
          }
        : {
            tone: "info",
            text: `群 ${group} 收到一条新消息`,
            href: groupHref(groupId),
          };
    }

    case "agent_run": {
      const status = pick<Schemas["AgentRunStatus"]>(
        AGENT_RUN_STATUS_LABELS,
        str(p, "status"),
      );
      const reason = pick<Schemas["AgentRunEndReason"]>(
        AGENT_RUN_END_REASON_LABELS,
        str(p, "endReason"),
      );
      const runId = str(p, "runId");
      const sentence: Record<Schemas["AgentRunStatus"], string> = {
        running: `群 ${group} 开始了一次 Agent 运行`,
        finished: `群 ${group} 的 Agent 运行已完成`,
        failed: `群 ${group} 的 Agent 运行失败${reason ? `（${AGENT_RUN_END_REASON_LABELS[reason]}）` : ""}`,
        blocked: `群 ${group} 的 Agent 运行被拦下（审计拿不到结论）`,
        cancelled: `群 ${group} 的 Agent 运行已取消`,
      };

      return {
        tone: status ? AGENT_RUN_STATUS_TONE[status] : "neutral",
        text: status ? sentence[status] : `群 ${group} 的 Agent 运行有变化`,
        href: runId ? `/agent-runs/${encodeURIComponent(runId)}` : null,
      };
    }

    case "sequence_run": {
      const status = str(p, "status");
      const step = num(p, "currentStepIndex");
      const href = groupId
        ? `/groups/${encodeURIComponent(groupId)}/sequences`
        : null;

      if (status === "running")
        return {
          tone: "info",
          text:
            step && step > 0
              ? `群 ${group} 的定时序列推进到第 ${step} 步`
              : `群 ${group} 启动了定时序列`,
          href,
        };

      const ended: Record<string, [StatusTone, string]> = {
        finished: ["success", "已完成"],
        failed: ["danger", "失败"],
        stopped: ["muted", "已停止"],
      };
      const [tone, label] = ended[status ?? ""] ?? ["neutral", "有变化"];

      return { tone, text: `群 ${group} 的定时序列${label}`, href };
    }

    case "member_changed": {
      const who = str(p, "accountId") ?? str(p, "platformUserId") ?? "成员";
      const change = str(p, "change");
      const text =
        change === "joined"
          ? `${who} 加入群 ${group}`
          : change === "left"
            ? `${who} 退出群 ${group}`
            : change === "promoted"
              ? `${who} 在群 ${group} 被提升为管理员`
              : `群 ${group} 的成员有变化`;

      return {
        tone:
          change === "left"
            ? "muted"
            : change === "promoted"
              ? "info"
              : "neutral",
        text,
        href: groupHref(groupId),
      };
    }

    case "group_status_changed": {
      const from = pick<Schemas["GroupStatus"]>(
        GROUP_STATUS_LABELS,
        str(p, "from"),
      );
      const to = pick<Schemas["GroupStatus"]>(
        GROUP_STATUS_LABELS,
        str(p, "to"),
      );

      return {
        tone: to ? GROUP_STATUS_TONE[to] : "neutral",
        text: `群 ${group} 状态变化：${from ? GROUP_STATUS_LABELS[from] : "?"} → ${to ? GROUP_STATUS_LABELS[to] : "?"}`,
        href: groupHref(groupId),
      };
    }

    case "group_settings_changed": {
      const onOff = (value: boolean | null) =>
        value === null ? "?" : value ? "开" : "关";

      return {
        tone: "neutral",
        text: `群 ${group} 开关：Agent 自动回复 ${onOff(bool(p, "agentEnabled"))} · 自动踢人 ${onOff(bool(p, "autoKickEnabled"))}`,
        href: groupHref(groupId),
      };
    }

    case "job": {
      const kind = pick<Schemas["JobKind"]>(JOB_KIND_LABELS, str(p, "kind"));
      const name = kind ? `${JOB_KIND_LABELS[kind]}任务` : "后台任务";
      const status = str(p, "status");
      const step = str(p, "step");
      const where = groupId ? `（群 ${group}）` : "";

      if (status === "finished")
        return {
          tone: "success",
          text: `${name}已完成${where}`,
          href: groupHref(groupId),
        };

      if (status === "failed")
        return {
          tone: "danger",
          text: `${name}失败${where}`,
          href: groupHref(groupId),
        };

      return {
        tone: "info",
        text: `${name}进行中${step ? `：${describeJobStep(step)}` : ""}${where}`,
        href: groupHref(groupId),
      };
    }

    case "inconsistency": {
      const kind = str(p, "kind");

      return {
        tone: "danger",
        text: `记录一条异常：${kind ? describeInconsistencyKind(kind) : "未知类型"}`,
        href: "/inconsistencies",
      };
    }

    default:
      return { tone: "muted", text: `事件 ${item.type}`, href: null };
  }
}

export function formatActivity(
  item: ActivityInput,
  context: ActivityContext = {},
): FormattedActivity {
  const groupLabel = (groupId: string | null) =>
    groupId ? (context.groupName?.(groupId) ?? shortId(groupId)) : "?";

  return {
    key: String(item.seq),
    category: activityCategory(item.type),
    createdAt: item.createdAt,
    ...describe(item, groupLabel),
  };
}

/** 动态的时间：一分钟内是「刚刚」，之后是相对时间（「3分钟前」）。now 由调用方传（渲染期不反复 new Date()）。 */
export function activityTimeLabel(createdAt: string, now: number): string {
  const time = new Date(createdAt).getTime();

  if (Number.isNaN(time)) return "-";

  if (Math.abs(now - time) < 60_000) return "刚刚";

  return formatRelativeTime(createdAt, now);
}

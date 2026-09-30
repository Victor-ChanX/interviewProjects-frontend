// 工作台的指标卡与「需要处理」清单：概览接口的计数 → 渲染就绪的卡片数据（纯函数，单 feature 留本地，配同位测试）。
// 链接都带筛选参数，点进去就是对应的那一批（Agent 运行按状态、实时动态按类型、异常中心默认未处理）。

import type { StatusTone } from "@/lib/status-tone";
import type { DashboardSummary } from "@/services/dashboard-service";

export type StatCardKey =
  | "accounts"
  | "groups"
  | "messages"
  | "agentRuns"
  | "sequences"
  | "inconsistencies";

export interface StatBreakdown {
  label: string;
  value: number;
  tone: StatusTone;
}

export interface StatCard {
  key: StatCardKey;
  title: string;
  value: number;
  /** 大数字后面的小字（「个在线」）。 */
  caption: string;
  /** 大数字的颜色：有需要人看的量时变红 / 变黄。 */
  tone: StatusTone;
  breakdown: StatBreakdown[];
  href: string;
}

/** 数量为 0 时不渲染红色，免得一片红。 */
function alert(value: number, tone: StatusTone): StatusTone {
  return value > 0 ? tone : "muted";
}

export function buildStatCards(summary: DashboardSummary): StatCard[] {
  const { accounts, groups, messages, agentRuns, sequenceRuns, jobs } = summary;
  const offline = accounts.idle + accounts.disconnected;
  const disabled = accounts.suspended + accounts.session_expired;
  const unresolved = summary.inconsistencies.unresolved;

  return [
    {
      key: "accounts",
      title: "服务账号",
      value: accounts.online,
      caption: `/ ${accounts.total} 在线`,
      tone: "neutral",
      breakdown: [
        { label: "在线", value: accounts.online, tone: "success" },
        {
          label: "限流",
          value: accounts.rate_limited,
          tone: alert(accounts.rate_limited, "warning"),
        },
        { label: "离线", value: offline, tone: "muted" },
        { label: "已停用", value: disabled, tone: alert(disabled, "danger") },
      ],
      href: "/accounts",
    },
    {
      key: "groups",
      title: "群组",
      value: groups.active,
      caption: `/ ${groups.total} 正常`,
      tone: "neutral",
      breakdown: [
        { label: "正常", value: groups.active, tone: "success" },
        {
          label: "不可写",
          value: groups.unreachable,
          tone: alert(groups.unreachable, "danger"),
        },
        { label: "已退出", value: groups.left, tone: "muted" },
        { label: "Agent 开启", value: groups.agentEnabled, tone: "info" },
      ],
      href: "/groups",
    },
    {
      key: "messages",
      title: "今日消息",
      value: messages.todayInbound + messages.todayOutbound,
      caption: "条",
      tone: "neutral",
      breakdown: [
        { label: "收", value: messages.todayInbound, tone: "info" },
        { label: "发", value: messages.todayOutbound, tone: "success" },
        {
          label: "失败",
          value: messages.outboundFailed,
          tone: alert(messages.outboundFailed, "danger"),
        },
        {
          label: "状态未知",
          value: messages.outboundUnknown,
          tone: alert(messages.outboundUnknown, "danger"),
        },
      ],
      href: "/activity?type=message",
    },
    {
      key: "agentRuns",
      title: "Agent 运行",
      value: agentRuns.running,
      caption: "进行中",
      tone: agentRuns.running > 0 ? "info" : "neutral",
      breakdown: [
        { label: "今日完成", value: agentRuns.todayFinished, tone: "success" },
        {
          label: "今日失败",
          value: agentRuns.todayFailed,
          tone: alert(agentRuns.todayFailed, "danger"),
        },
        {
          label: "被拦下",
          value: agentRuns.blocked,
          tone: alert(agentRuns.blocked, "danger"),
        },
      ],
      href: "/agent-runs",
    },
    {
      key: "sequences",
      title: "定时序列",
      value: sequenceRuns.running,
      caption: "进行中",
      tone: sequenceRuns.running > 0 ? "info" : "neutral",
      breakdown: [
        { label: "后台任务进行中", value: jobs.running, tone: "info" },
        {
          label: "今日失败任务",
          value: jobs.todayFailed,
          tone: alert(jobs.todayFailed, "danger"),
        },
      ],
      href: "/sequences",
    },
    {
      key: "inconsistencies",
      title: "待处理异常",
      value: unresolved,
      caption: "条未处理",
      tone: alert(unresolved, "danger"),
      breakdown: [],
      href: "/inconsistencies",
    },
  ];
}

export type AttentionKey =
  | "blockedRuns"
  | "failedMessages"
  | "unknownMessages"
  | "failedJobs"
  | "inconsistencies";

export interface AttentionItem {
  key: AttentionKey;
  label: string;
  description: string;
  count: number;
  tone: StatusTone;
  href: string;
}

/** 「需要处理」：每条都给出计数与去处；计数为 0 的也列出（显示「无」），让人知道查过了。 */
export function buildAttentionItems(
  summary: DashboardSummary,
): AttentionItem[] {
  return [
    {
      key: "blockedRuns",
      label: "被拦下的 Agent 运行",
      description: "审计拿不到结论，对应工具没有执行",
      count: summary.agentRuns.blocked,
      tone: "danger",
      href: "/agent-runs?status=blocked",
    },
    {
      key: "failedMessages",
      label: "发送失败的消息",
      description: "网关拒绝或两次超时都没发出",
      count: summary.messages.outboundFailed,
      tone: "danger",
      href: "/activity?type=message",
    },
    {
      key: "unknownMessages",
      label: "状态未知的消息",
      description: "网关超时，正在确认是否已送达",
      count: summary.messages.outboundUnknown,
      tone: "warning",
      href: "/activity?type=message",
    },
    {
      key: "failedJobs",
      label: "今日失败的后台任务",
      description: "建群 / 全部退群中有步骤失败",
      count: summary.jobs.todayFailed,
      tone: "danger",
      href: "/activity?type=job",
    },
    {
      key: "inconsistencies",
      label: "未处理的异常",
      description: "未知群、入站事件处理失败、退群对账不一致",
      count: summary.inconsistencies.unresolved,
      tone: "danger",
      href: "/inconsistencies",
    },
  ];
}

/** 还有几条要人看。 */
export function pendingAttention(items: readonly AttentionItem[]): number {
  return items.filter((item) => item.count > 0).length;
}

// 群详情的页签（消息 / 成员 / Agent 运行 / 序列），存在 URL 里（`?tab=members`），刷新与分享链接都保留。

export const GROUP_TABS = ["messages", "members", "runs", "sequences"] as const;

export type GroupTab = (typeof GROUP_TABS)[number];

export const GROUP_TAB_LABELS: Readonly<Record<GroupTab, string>> = {
  messages: "消息",
  members: "成员",
  runs: "Agent 运行",
  sequences: "序列",
};

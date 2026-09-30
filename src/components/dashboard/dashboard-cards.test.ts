import { describe, expect, it } from "vitest";

import type { DashboardSummary } from "@/services/dashboard-service";

import {
  buildAttentionItems,
  buildStatCards,
  pendingAttention,
} from "./dashboard-cards";

function summary(patch: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    accounts: {
      idle: 1,
      online: 3,
      rate_limited: 1,
      disconnected: 1,
      suspended: 1,
      session_expired: 0,
      total: 7,
    },
    groups: { active: 2, unreachable: 1, left: 1, total: 4, agentEnabled: 1 },
    messages: {
      todayInbound: 10,
      todayOutbound: 4,
      outboundFailed: 0,
      outboundUnknown: 2,
      outboundQueued: 1,
    },
    agentRuns: { running: 1, todayFinished: 5, todayFailed: 0, blocked: 1 },
    sequenceRuns: { running: 0 },
    jobs: { running: 0, todayFailed: 3 },
    inconsistencies: { unresolved: 0 },
    dayStart: "2026-09-29T16:00:00.000Z",
    timeZone: "Asia/Shanghai",
    generatedAt: "2026-09-30T08:00:00.000Z",
    ...patch,
  };
}

describe("buildStatCards", () => {
  it("builds the six cards in order with filtered links", () => {
    const cards = buildStatCards(summary());

    expect(cards.map((card) => [card.key, card.title, card.href])).toEqual([
      ["accounts", "服务账号", "/accounts"],
      ["groups", "群组", "/groups"],
      ["messages", "今日消息", "/activity?type=message"],
      ["agentRuns", "Agent 运行", "/agent-runs"],
      ["sequences", "定时序列", "/sequences"],
      ["inconsistencies", "待处理异常", "/inconsistencies"],
    ]);
  });

  it("folds account states into online / rate-limited / offline / disabled", () => {
    const [accounts] = buildStatCards(summary());

    expect(accounts.value).toBe(3);
    expect(accounts.caption).toBe("/ 7 在线");
    expect(accounts.breakdown).toEqual([
      { label: "在线", value: 3, tone: "success" },
      { label: "限流", value: 1, tone: "warning" },
      { label: "离线", value: 2, tone: "muted" },
      { label: "已停用", value: 1, tone: "danger" },
    ]);
  });

  it("marks failures red only when non-zero", () => {
    const messages = buildStatCards(summary())[2];

    expect(messages.value).toBe(14);
    expect(messages.breakdown.find((b) => b.label === "失败")?.tone).toBe(
      "muted",
    );
    expect(messages.breakdown.find((b) => b.label === "状态未知")?.tone).toBe(
      "danger",
    );

    const inconsistencies = buildStatCards(
      summary({ inconsistencies: { unresolved: 2 } }),
    )[5];

    expect(inconsistencies).toMatchObject({ value: 2, tone: "danger" });
    expect(buildStatCards(summary())[5].tone).toBe("muted");
  });
});

describe("buildAttentionItems", () => {
  it("lists every check with its count and filtered destination", () => {
    const items = buildAttentionItems(summary());

    expect(items.map((item) => [item.key, item.count, item.href])).toEqual([
      ["blockedRuns", 1, "/agent-runs?status=blocked"],
      ["failedMessages", 0, "/activity?type=message"],
      ["unknownMessages", 2, "/activity?type=message"],
      ["failedJobs", 3, "/activity?type=job"],
      ["inconsistencies", 0, "/inconsistencies"],
    ]);
    expect(pendingAttention(items)).toBe(3);
  });

  it("counts zero pending when everything is clear", () => {
    const clear = summary({
      agentRuns: { running: 0, todayFinished: 0, todayFailed: 0, blocked: 0 },
      messages: {
        todayInbound: 0,
        todayOutbound: 0,
        outboundFailed: 0,
        outboundUnknown: 0,
        outboundQueued: 0,
      },
      jobs: { running: 0, todayFailed: 0 },
    });

    expect(pendingAttention(buildAttentionItems(clear))).toBe(0);
  });
});

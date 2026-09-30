import { describe, expect, it } from "vitest";

import {
  ACTIVITY_CATEGORIES,
  activityCategory,
  activityTimeLabel,
  formatActivity,
  type ActivityInput,
} from "@/lib/activity-format";

const GROUP_ID = "01a0f2e4-bd5c-771a-9fc1-cd66fef966de";
const AT = "2026-09-30T08:00:00.000Z";

function item(
  type: string,
  payload: Record<string, unknown>,
  seq = 1,
): ActivityInput {
  return { seq, type, payload, createdAt: AT };
}

const groupName = (id: string) => (id === GROUP_ID ? "g_5ffed3d96722" : null);

describe("formatActivity", () => {
  it("describes account transitions and terminal states", () => {
    expect(
      formatActivity(
        item("account_status_changed", {
          accountId: "acc-2",
          from: "online",
          to: "rate_limited",
        }),
      ),
    ).toEqual({
      key: "1",
      category: "account",
      tone: "warning",
      text: "acc-2 状态变化：在线 → 限流中",
      href: "/accounts",
      createdAt: AT,
    });
    expect(
      formatActivity(
        item("account_terminal", { accountId: "acc-3", status: "suspended" }),
      ).text,
    ).toBe("acc-3 被平台停用");
    expect(
      formatActivity(
        item("account_terminal", {
          accountId: "acc-3",
          status: "session_expired",
        }),
      ).text,
    ).toBe("acc-3 会话失效（终态）");
  });

  it("names groups by gateway id and falls back to the short local id", () => {
    const sent = formatActivity(
      item("message", {
        groupId: GROUP_ID,
        msgId: "m1",
        isOwn: true,
        deliveryStatus: "sent",
      }),
      { groupName },
    );

    expect(sent.text).toBe("群 g_5ffed3d96722 的出站消息已发送");
    expect(sent.tone).toBe("success");
    expect(sent.href).toBe(`/groups/${GROUP_ID}`);

    expect(
      formatActivity(item("message", { groupId: GROUP_ID, isOwn: false })).text,
    ).toBe("群 …fef966de 收到一条新消息");
  });

  it("shows the fail code of failed / cancelled outbound messages", () => {
    const failed = formatActivity(
      item("message", {
        groupId: GROUP_ID,
        isOwn: true,
        deliveryStatus: "failed",
        failCode: "NETWORK_TIMEOUT",
      }),
      { groupName },
    );

    expect(failed.text).toBe(
      "群 g_5ffed3d96722 的出站消息发送失败（NETWORK_TIMEOUT）",
    );
    expect(failed.tone).toBe("danger");
    expect(
      formatActivity(item("message", { groupId: GROUP_ID, isOwn: true }), {
        groupName,
      }).text,
    ).toBe("群 g_5ffed3d96722 收到自己发出消息的回流");
  });

  it("links agent runs to their detail page", () => {
    const blocked = formatActivity(
      item("agent_run", {
        runId: "r 1",
        groupId: GROUP_ID,
        status: "blocked",
        endReason: "audit_blocked",
      }),
      { groupName },
    );

    expect(blocked).toMatchObject({
      category: "agent",
      tone: "danger",
      text: "群 g_5ffed3d96722 的 Agent 运行被拦下（审计拿不到结论）",
      href: "/agent-runs/r%201",
    });
    expect(
      formatActivity(
        item("agent_run", {
          runId: "r1",
          groupId: GROUP_ID,
          status: "finished",
        }),
        { groupName },
      ).text,
    ).toBe("群 g_5ffed3d96722 的 Agent 运行已完成");
    expect(
      formatActivity(
        item("agent_run", {
          runId: "r1",
          groupId: GROUP_ID,
          status: "failed",
          endReason: "protocol_errors",
        }),
        { groupName },
      ).text,
    ).toBe("群 g_5ffed3d96722 的 Agent 运行失败（协议错误过多）");
  });

  it("describes sequence progress and endings", () => {
    const base = { runId: "s1", groupId: GROUP_ID };

    expect(
      formatActivity(
        item("sequence_run", {
          ...base,
          status: "running",
          currentStepIndex: 2,
        }),
        { groupName },
      ),
    ).toMatchObject({
      text: "群 g_5ffed3d96722 的定时序列推进到第 2 步",
      href: `/groups/${GROUP_ID}/sequences`,
    });
    expect(
      formatActivity(
        item("sequence_run", {
          ...base,
          status: "running",
          currentStepIndex: 0,
        }),
        { groupName },
      ).text,
    ).toBe("群 g_5ffed3d96722 启动了定时序列");
    expect(
      formatActivity(item("sequence_run", { ...base, status: "stopped" }), {
        groupName,
      }),
    ).toMatchObject({
      tone: "muted",
      text: "群 g_5ffed3d96722 的定时序列已停止",
    });
  });

  it("describes member, group and job events", () => {
    const ctx = { groupName };

    expect(
      formatActivity(
        item("member_changed", {
          groupId: GROUP_ID,
          platformUserId: "ext-carol",
          accountId: null,
          change: "joined",
        }),
        ctx,
      ).text,
    ).toBe("ext-carol 加入群 g_5ffed3d96722");
    expect(
      formatActivity(
        item("member_changed", {
          groupId: GROUP_ID,
          platformUserId: "pu_x",
          accountId: "acc-2",
          change: "promoted",
        }),
        ctx,
      ).text,
    ).toBe("acc-2 在群 g_5ffed3d96722 被提升为管理员");
    expect(
      formatActivity(
        item("group_status_changed", {
          groupId: GROUP_ID,
          from: "active",
          to: "unreachable",
        }),
        ctx,
      ),
    ).toMatchObject({
      tone: "danger",
      text: "群 g_5ffed3d96722 状态变化：正常 → 不可写",
    });
    expect(
      formatActivity(
        item("group_settings_changed", {
          groupId: GROUP_ID,
          agentEnabled: true,
          autoKickEnabled: false,
        }),
        ctx,
      ).text,
    ).toBe("群 g_5ffed3d96722 开关：Agent 自动回复 开 · 自动踢人 关");
    expect(
      formatActivity(
        item("job", {
          jobId: "j1",
          groupId: GROUP_ID,
          kind: "create_group",
          status: "running",
          step: "join:acc-3",
        }),
        ctx,
      ).text,
    ).toBe("建群任务进行中：账号 acc-3 入群（群 g_5ffed3d96722）");
    expect(
      formatActivity(
        item("job", {
          jobId: "j1",
          groupId: GROUP_ID,
          kind: "leave_all",
          status: "failed",
        }),
        ctx,
      ),
    ).toMatchObject({
      tone: "danger",
      text: "全部退群任务失败（群 g_5ffed3d96722）",
    });
  });

  it("points inconsistencies to the inconsistency center", () => {
    expect(
      formatActivity(
        item("inconsistency", {
          inconsistencyId: "i1",
          kind: "inbound_unknown_group",
          ref: "12",
          message: "…",
        }),
      ),
    ).toMatchObject({
      category: "inconsistency",
      tone: "danger",
      text: "记录一条异常：未知群",
      href: "/inconsistencies",
    });
  });

  it("survives unknown types and malformed payloads", () => {
    expect(formatActivity(item("brand_new", {}))).toMatchObject({
      category: null,
      tone: "muted",
      text: "事件 brand_new",
      href: null,
    });
    expect(
      formatActivity(item("account_status_changed", { accountId: 3 })).text,
    ).toBe("账号 状态变化：? → ?");
    expect(formatActivity(item("message", {})).href).toBeNull();
  });
});

describe("activityCategory", () => {
  it("covers every activity type with one of the filter categories", () => {
    for (const type of [
      "account_status_changed",
      "account_terminal",
      "inconsistency",
      "message",
      "agent_run",
      "sequence_run",
      "group_status_changed",
      "group_settings_changed",
      "member_changed",
      "job",
    ])
      expect(ACTIVITY_CATEGORIES).toContain(activityCategory(type));

    expect(activityCategory("inconsistency_resolved")).toBeNull();
    expect(activityCategory("constructor")).toBeNull();
  });
});

describe("activityTimeLabel", () => {
  const now = Date.parse("2026-09-30T08:10:00.000Z");

  it("says 刚刚 within a minute, then relative time", () => {
    expect(activityTimeLabel("2026-09-30T08:09:30.000Z", now)).toBe("刚刚");
    expect(activityTimeLabel("2026-09-30T08:07:00.000Z", now)).toBe("3分钟前");
    expect(activityTimeLabel("2026-09-30T06:10:00.000Z", now)).toBe("2小时前");
    expect(activityTimeLabel("nope", now)).toBe("-");
  });
});

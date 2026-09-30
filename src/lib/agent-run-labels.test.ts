import { describe, expect, it } from "vitest";

import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_CLASS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_STEP_KIND_LABELS,
  AUDIT_VERDICT_CLASS,
  AUDIT_VERDICT_LABELS,
} from "@/lib/agent-run-labels";

describe("agent run labels", () => {
  it("covers every status with a label and a token-only badge class", () => {
    expect(AGENT_RUN_STATUS_LABELS).toEqual({
      running: "运行中",
      finished: "已完成",
      failed: "失败",
      blocked: "已拦截",
      cancelled: "已取消",
    });
    expect(Object.keys(AGENT_RUN_STATUS_CLASS).sort()).toEqual(
      Object.keys(AGENT_RUN_STATUS_LABELS).sort(),
    );
    // 题目：blocked 的 run 要醒目 —— 徽标用实色 destructive 边框而不是 /40 的淡边。
    expect(AGENT_RUN_STATUS_CLASS.blocked).toContain("border-destructive ");
    expect(AGENT_RUN_STATUS_CLASS.blocked).toContain("font-semibold");
  });

  it("maps every endReason to the wording of the spec", () => {
    expect(AGENT_RUN_END_REASON_LABELS).toEqual({
      final: "正常结束",
      budget_exhausted: "预算耗尽",
      wall_clock: "超时",
      protocol_errors: "协议错误过多",
      audit_blocked: "审计拦截",
      cancelled: "被取消",
    });
  });

  it("labels the three step kinds and both audit verdicts", () => {
    expect(AGENT_STEP_KIND_LABELS).toEqual({
      tool_use: "工具调用",
      final: "结束",
      protocol_error: "协议错误",
    });
    expect(AUDIT_VERDICT_LABELS).toEqual({ pass: "通过", fail: "拒绝" });
    expect(AUDIT_VERDICT_CLASS.pass).toBe("text-success");
    expect(AUDIT_VERDICT_CLASS.fail).toBe("text-destructive");
  });
});

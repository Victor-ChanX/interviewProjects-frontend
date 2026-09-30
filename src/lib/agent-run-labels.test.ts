import { describe, expect, it } from "vitest";

import {
  AGENT_RUN_END_REASON_LABELS,
  AGENT_RUN_STATUS_FILTERS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STATUS_TONE,
  AGENT_STEP_KIND_LABELS,
  AGENT_STEP_KIND_TONE,
  AUDIT_VERDICT_CLASS,
  AUDIT_VERDICT_LABELS,
} from "@/lib/agent-run-labels";

describe("agent run labels", () => {
  it("covers every status with a label and a tone (manual wording: blocked = 被拦下)", () => {
    expect(AGENT_RUN_STATUS_LABELS).toEqual({
      running: "运行中",
      finished: "已完成",
      failed: "失败",
      blocked: "被拦下",
      cancelled: "已取消",
    });
    expect(Object.keys(AGENT_RUN_STATUS_TONE).sort()).toEqual(
      Object.keys(AGENT_RUN_STATUS_LABELS).sort(),
    );
    // 题目：blocked 的 run 要醒目。
    expect(AGENT_RUN_STATUS_TONE.blocked).toBe("danger");
    expect(AGENT_RUN_STATUS_TONE.finished).toBe("success");
  });

  it("lists the filter tabs: all first, then every status once", () => {
    expect(AGENT_RUN_STATUS_FILTERS[0]).toBe("all");
    expect([...AGENT_RUN_STATUS_FILTERS.slice(1)].sort()).toEqual(
      Object.keys(AGENT_RUN_STATUS_LABELS).sort(),
    );
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
    expect(AGENT_STEP_KIND_TONE.protocol_error).toBe("danger");
    expect(AUDIT_VERDICT_LABELS).toEqual({ pass: "通过", fail: "拒绝" });
    expect(AUDIT_VERDICT_CLASS.pass).toBe("text-success");
    expect(AUDIT_VERDICT_CLASS.fail).toBe("text-destructive");
  });
});

import { describe, expect, it } from "vitest";

import { describeJobErrorCode, describeJobStep } from "@/lib/job-labels";

describe("describeJobStep", () => {
  it("labels the account-less steps", () => {
    expect(describeJobStep("create")).toBe("在网关建群");
    expect(describeJobStep("invite")).toBe("申请邀请链接");
    expect(describeJobStep("promote")).toBe("提升管理员");
  });

  it("labels per-account steps with the account id", () => {
    expect(describeJobStep("join:acc_1")).toBe("账号 acc_1 入群");
    expect(describeJobStep("leave:acc_2")).toBe("账号 acc_2 退群");
  });

  it("returns unknown steps untouched", () => {
    expect(describeJobStep("rollback")).toBe("rollback");
    expect(describeJobStep("rollback:acc_1")).toBe("rollback:acc_1");
    expect(describeJobStep("")).toBe("");
  });
});

describe("describeJobErrorCode", () => {
  it("explains the codes the job records", () => {
    expect(describeJobErrorCode("JOIN_TIMEOUT")).toBe(
      "入群超时：10 秒内没等到入群事件",
    );
    expect(describeJobErrorCode("INVITE_EXPIRED")).toBe(
      "邀请链接已过期（重新申请后仍过期）",
    );
    expect(describeJobErrorCode("GATEWAY_UNAVAILABLE")).toBe("网关连续不可用");
  });

  it("returns null for unknown codes (shown raw by the caller)", () => {
    expect(describeJobErrorCode("SOMETHING_NEW")).toBeNull();
    // 原型链上的名字不能被当成已知码。
    expect(describeJobErrorCode("toString")).toBeNull();
  });
});

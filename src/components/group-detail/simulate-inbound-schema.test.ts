import { describe, expect, it } from "vitest";

import {
  EMPTY_SIMULATE_INBOUND_FORM,
  simulateInboundSchema,
} from "@/components/group-detail/simulate-inbound-schema";

describe("simulateInboundSchema", () => {
  it("trims both fields", () => {
    expect(
      simulateInboundSchema.parse({
        senderPlatformUserId: "  ext-alice ",
        text: "  请问几点开始？  ",
      }),
    ).toEqual({ senderPlatformUserId: "ext-alice", text: "请问几点开始？" });
  });

  it("rejects blank fields and over-long values with user-facing messages", () => {
    const blank = simulateInboundSchema.safeParse({
      senderPlatformUserId: " ",
      text: "   ",
    });

    expect(blank.success).toBe(false);

    if (!blank.success)
      expect(blank.error.issues.map((issue) => issue.message)).toEqual([
        "请填写外部成员 ID",
        "消息内容不能为空",
      ]);

    const long = simulateInboundSchema.safeParse({
      senderPlatformUserId: "x".repeat(65),
      text: "y".repeat(2001),
    });

    expect(long.success).toBe(false);

    if (!long.success)
      expect(long.error.issues.map((issue) => issue.message)).toEqual([
        "外部成员 ID 不能超过 64 个字符",
        "消息内容不能超过 2000 个字符",
      ]);
  });

  it("starts with a sender id that is not a managed account", () => {
    expect(EMPTY_SIMULATE_INBOUND_FORM.senderPlatformUserId).toBe("ext-demo");
    expect(EMPTY_SIMULATE_INBOUND_FORM.text).toBe("");
  });
});

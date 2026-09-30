import { describe, expect, it } from "vitest";

import { sendMessageSchema } from "@/components/group-detail/send-message-schema";

describe("sendMessageSchema", () => {
  it("accepts an account and text, trimming the text", () => {
    expect(
      sendMessageSchema.parse({ accountId: "a1", text: "  hello  " }),
    ).toEqual({ accountId: "a1", text: "hello" });
  });

  it("rejects a missing account and whitespace-only text with user-facing messages", () => {
    const result = sendMessageSchema.safeParse({ accountId: "", text: "   " });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues.map((issue) => issue.message)).toEqual([
      "请选择发送账号",
      "消息内容不能为空",
    ]);
  });
});

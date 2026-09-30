import { describe, expect, it } from "vitest";

import {
  EMPTY_SIMULATE_INBOUND_FORM,
  SIMULATE_IMAGE_MAX_BYTES,
  simulateInboundSchema,
  validateImage,
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

describe("validateImage", () => {
  it("accepts the four image types up to the size cap", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"])
      expect(
        validateImage({ type, size: SIMULATE_IMAGE_MAX_BYTES }),
      ).toBeNull();
  });

  it("rejects other types and files over the cap with a reason", () => {
    expect(validateImage({ type: "application/pdf", size: 10 })).toBe(
      "只支持 PNG / JPEG / GIF / WebP 图片",
    );
    expect(
      validateImage({ type: "image/png", size: SIMULATE_IMAGE_MAX_BYTES + 1 }),
    ).toBe("图片不能超过 1 MB");
  });
});

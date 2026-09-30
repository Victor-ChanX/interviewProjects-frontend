import { describe, expect, it } from "vitest";

import { loginSchema } from "@/components/login/login-schema";

describe("loginSchema", () => {
  it("accepts a username and password, trimming the username", () => {
    expect(
      loginSchema.parse({ username: "  admin ", password: "admin" }),
    ).toEqual({
      username: "admin",
      password: "admin",
    });
  });

  it("rejects empty fields with user-facing messages", () => {
    const result = loginSchema.safeParse({ username: "   ", password: "" });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues.map((issue) => issue.message)).toEqual([
      "请输入用户名",
      "请输入密码",
    ]);
  });

  it("enforces the backend length limits", () => {
    expect(
      loginSchema.safeParse({ username: "a".repeat(65), password: "x" })
        .success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ username: "a", password: "x".repeat(257) })
        .success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        username: "a".repeat(64),
        password: "x".repeat(256),
      }).success,
    ).toBe(true);
  });
});

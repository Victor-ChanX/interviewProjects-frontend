import { afterEach, describe, expect, it, vi } from "vitest";

import { login } from "@/services/auth-service";

const apiPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { post: apiPost },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("login", () => {
  it("posts the credentials to /api/auth/login without an Authorization header", async () => {
    apiPost.mockResolvedValueOnce({ accessToken: "jwt" });

    await expect(
      login({ username: "admin", password: "admin" }),
    ).resolves.toEqual({ accessToken: "jwt" });

    expect(apiPost).toHaveBeenCalledWith(
      "/api/auth/login",
      { username: "admin", password: "admin" },
      { auth: false },
    );
  });

  it("propagates the request error untouched", async () => {
    const failure = new Error("用户名或密码错误");

    apiPost.mockRejectedValueOnce(failure);

    await expect(login({ username: "x", password: "y" })).rejects.toBe(failure);
  });
});

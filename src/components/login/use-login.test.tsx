// @vitest-environment jsdom
// 登录 hook：调了什么（login 服务）、存了什么（会话）、去了哪（navigate）、失败展示什么。
// service 层与 react-router 的 useNavigate 都 mock，不发真实请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLogin } from "@/components/login/use-login";
import { clearSession, getAccessToken, getSession } from "@/lib/auth";
import { RequestError } from "@/lib/request";

const navigate = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => vi.fn());

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/services/auth-service", () => ({ login }));

function base64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const ADMIN_TOKEN = `${base64Url("{}")}.${base64Url(
  JSON.stringify({
    username: "admin",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 900,
  }),
)}.sig`;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

async function fillAndSubmit(
  result: { current: ReturnType<typeof useLogin> },
  values: { username: string; password: string },
) {
  // register() 把字段登记进 RHF；没有真实 DOM 时用 onChange 事件喂值。
  await act(async () => {
    await result.current
      .register("username")
      .onChange({ target: { name: "username", value: values.username } });
    await result.current
      .register("password")
      .onChange({ target: { name: "password", value: values.password } });
  });
  await act(async () => {
    await result.current.submit();
  });
}

afterEach(() => {
  clearSession();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("useLogin", () => {
  it("stores the token and navigates to next after a successful login", async () => {
    login.mockResolvedValueOnce({ accessToken: ADMIN_TOKEN });

    const { result } = renderHook(() => useLogin("/groups/g1"), { wrapper });

    await fillAndSubmit(result, { username: "admin", password: "admin" });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/groups/g1", { replace: true });
    });
    expect(login).toHaveBeenCalledWith({
      username: "admin",
      password: "admin",
    });
    expect(getAccessToken()).toBe(ADMIN_TOKEN);
    expect(getSession()).toEqual({ username: "admin", role: "admin" });
    expect(result.current.errorMessage).toBeNull();
  });

  it("shows the error envelope message and keeps the session empty on failure", async () => {
    login.mockRejectedValueOnce(
      new RequestError(401, "用户名或密码错误", undefined, "UNAUTHORIZED"),
    );

    const { result } = renderHook(() => useLogin("/accounts"), { wrapper });

    await fillAndSubmit(result, { username: "admin", password: "wrong" });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("用户名或密码错误");
    });
    expect(result.current.pending).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it("does not call the service when zod rejects the form", async () => {
    const { result } = renderHook(() => useLogin("/accounts"), { wrapper });

    await fillAndSubmit(result, { username: "", password: "" });

    expect(login).not.toHaveBeenCalled();
    expect(result.current.errors.username?.message).toBe("请输入用户名");
    expect(result.current.errors.password?.message).toBe("请输入密码");
  });
});

// @vitest-environment jsdom
// 受保护布局的加载守卫（题目 B3 刷新页面场景）：无会话时先静默 refresh 一次再决定跳不跳登录。
// 请求层的 refreshAccessToken、react-router 的 useNavigate / useLocation、实时连接都 mock，不发真实请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppShell } from "@/components/app-shell/use-app-shell";
import { clearSession, setAccessToken } from "@/lib/auth";

const navigate = vi.hoisted(() => vi.fn());
const refreshAccessToken = vi.hoisted(() => vi.fn());

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
  useLocation: () => ({
    pathname: "/groups/g1",
    search: "?tab=members",
    hash: "",
    state: null,
    key: "k",
  }),
}));

vi.mock("@/lib/request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/request")>()),
  refreshAccessToken,
}));

// 实时连接是应用级单例：只替换建连 / 断连，其它导出（状态订阅）保留。
vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
}));

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
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  clearSession();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("useAppShell bootstrap (no session at mount)", () => {
  it("is checking first, then renders the session when the silent refresh succeeds", async () => {
    refreshAccessToken.mockImplementationOnce(async () => {
      // 真实刷新要等一次网络往返；这里让出一个宏任务，好断言中间的 checking 态。
      await new Promise((resolve) => setTimeout(resolve, 0));
      // 请求层刷新成功的副作用：写入新 token（会话订阅者随之更新）。
      setAccessToken(ADMIN_TOKEN);

      return true;
    });

    const { result } = renderHook(() => useAppShell(), { wrapper });

    expect(result.current.checking).toBe(true);
    expect(result.current.session).toBeNull();

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(result.current.session).toEqual({
      username: "admin",
      role: "admin",
      canWrite: true,
    });
    expect(refreshAccessToken).toHaveBeenCalledWith({ silent: true });
    // 不跳登录：既没有 navigate，容器也不会走 <Navigate>（session 非空）。
    expect(navigate).not.toHaveBeenCalled();
  });

  it("settles with no session (guard redirects to login with next) when the refresh fails", async () => {
    refreshAccessToken.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useAppShell(), { wrapper });

    expect(result.current.checking).toBe(true);

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(result.current.session).toBeNull();
    expect(result.current.loginRedirect).toBe(
      "/login?next=%2Fgroups%2Fg1%3Ftab%3Dmembers",
    );
    // silent：失败由容器的 <Navigate> 跳一次，hook 自己不 navigate（否则双跳）。
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not call refresh when a session already exists", () => {
    setAccessToken(ADMIN_TOKEN);

    const { result } = renderHook(() => useAppShell(), { wrapper });

    expect(result.current.checking).toBe(false);
    expect(result.current.session).toMatchObject({ username: "admin" });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

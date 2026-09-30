// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestError } from "@/lib/request";
import type { AccountRead } from "@/services/account-service";

import { useAccountList } from "./use-account-list";

const session = vi.hoisted(() => ({
  username: "admin",
  role: "admin",
  canWrite: true,
}));
const service = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  connectAccount: vi.fn(),
  transitionAccount: vi.fn(),
}));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/use-session", () => ({ useSession: () => session }));
vi.mock("@/services/account-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/account-service")>()),
  ...service,
}));
vi.mock("sonner", () => ({ toast }));

const ACCOUNTS: AccountRead[] = [
  {
    id: "a-idle",
    status: "idle",
    platformUserId: null,
    rateLimitedUntil: null,
  },
  {
    id: "a-online",
    status: "online",
    platformUserId: "u-online",
    rateLimitedUntil: null,
  },
  {
    id: "a-limited",
    status: "rate_limited",
    platformUserId: "u-limited",
    rateLimitedUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
  },
  {
    id: "a-off",
    status: "disconnected",
    platformUserId: "u-off",
    rateLimitedUntil: null,
  },
  {
    id: "a-susp",
    status: "suspended",
    platformUserId: "u-susp",
    rateLimitedUntil: null,
  },
  {
    id: "a-exp",
    status: "session_expired",
    platformUserId: null,
    rateLimitedUntil: null,
  },
];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, ...renderHook(() => useAccountList(), { wrapper }) };
}

async function setupLoaded() {
  service.listAccounts.mockResolvedValue(ACCOUNTS);

  const rendered = setup();

  await waitFor(() => expect(rendered.result.current.loading).toBe(false));

  return rendered;
}

function conflict(code: string) {
  return new RequestError(409, `后端说 ${code}`, undefined, code);
}

afterEach(() => {
  session.canWrite = true;
  session.role = "admin";
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("useAccountList rows", () => {
  it("shows only the legal buttons per status for a writer", async () => {
    const { result } = await setupLoaded();

    expect(
      Object.fromEntries(
        result.current.rows.map((row) => [row.status, row.actions]),
      ),
    ).toEqual({
      idle: ["reconnect"],
      online: ["markOffline", "release"],
      rate_limited: ["markOffline"],
      disconnected: ["reconnect", "release"],
      suspended: [],
      session_expired: [],
    });
  });

  it("hides every button for a viewer", async () => {
    session.canWrite = false;
    session.role = "viewer";

    const { result } = await setupLoaded();

    expect(result.current.rows).toHaveLength(ACCOUNTS.length);
    expect(result.current.rows.every((row) => row.actions.length === 0)).toBe(
      true,
    );
  });

  it("marks terminal rows and formats rateLimitedUntil relatively", async () => {
    const { result } = await setupLoaded();
    const byId = Object.fromEntries(
      result.current.rows.map((row) => [row.id, row]),
    );

    expect(byId["a-susp"].terminal).toBe(true);
    expect(byId["a-exp"].terminal).toBe(true);
    expect(byId["a-online"].terminal).toBe(false);
    expect(byId["a-limited"].rateLimitedUntilLabel).toBe("5分钟后");
    expect(byId["a-online"].rateLimitedUntilLabel).toBeNull();
  });
});

describe("useAccountList actions", () => {
  it("sends expectedFrom = the displayed status and patches the row on success", async () => {
    service.transitionAccount.mockResolvedValue({
      ...ACCOUNTS[1],
      status: "disconnected",
      from: "online",
      changed: true,
      membersRemovedCount: 0,
      messagesCancelledCount: 0,
      stepsSkippedCount: 0,
    });

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-online", "markOffline"));

    expect(service.transitionAccount).toHaveBeenCalledWith("a-online", {
      to: "disconnected",
      expectedFrom: "online",
    });
    expect(toast.success).toHaveBeenCalledWith("已标记离线：a-online");

    // setQueryData 的通知是异步批处理的，行要等一拍才换。
    await waitFor(() =>
      expect(result.current.rows.find((r) => r.id === "a-online")?.status).toBe(
        "disconnected",
      ),
    );
    expect(
      result.current.rows.find((r) => r.id === "a-online")?.actions,
    ).toEqual(["reconnect", "release"]);
    // 成功路径用响应就地改行，不重拉列表。
    expect(service.listAccounts).toHaveBeenCalledTimes(1);
  });

  it("uses POST connect for 重连 and releases with to = idle", async () => {
    service.connectAccount.mockResolvedValue({
      ...ACCOUNTS[0],
      status: "online",
      platformUserId: "u-new",
    });
    service.transitionAccount.mockResolvedValue({
      ...ACCOUNTS[3],
      status: "idle",
      from: "disconnected",
      changed: true,
      membersRemovedCount: 0,
      messagesCancelledCount: 0,
      stepsSkippedCount: 0,
    });

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-idle", "reconnect"));
    await act(() => result.current.onAction("a-off", "release"));

    expect(service.connectAccount).toHaveBeenCalledWith("a-idle");
    expect(service.transitionAccount).toHaveBeenCalledWith("a-off", {
      to: "idle",
      expectedFrom: "disconnected",
    });
    await waitFor(() =>
      expect(
        result.current.rows.find((r) => r.id === "a-idle")?.platformUserId,
      ).toBe("u-new"),
    );
  });

  it("warns and refetches on 409 CAS_CONFLICT", async () => {
    service.transitionAccount.mockRejectedValueOnce(conflict("CAS_CONFLICT"));
    service.listAccounts.mockResolvedValue(ACCOUNTS);

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-online", "markOffline"));

    expect(toast.warning).toHaveBeenCalledWith("状态已变化，列表已刷新");
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
  });

  it("treats ILLEGAL_TRANSITION the same way (displayed state is stale)", async () => {
    service.connectAccount.mockRejectedValueOnce(
      conflict("ILLEGAL_TRANSITION"),
    );

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-idle", "reconnect"));

    expect(toast.warning).toHaveBeenCalledWith("状态已变化，列表已刷新");
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
  });

  it("shows the backend message for GATEWAY_ERROR without refetching", async () => {
    service.connectAccount.mockRejectedValueOnce(
      new RequestError(502, "消息网关暂时不可用", undefined, "GATEWAY_ERROR"),
    );

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-idle", "reconnect"));

    expect(toast.error).toHaveBeenCalledWith("消息网关暂时不可用");
    expect(toast.warning).not.toHaveBeenCalled();
    expect(service.listAccounts).toHaveBeenCalledTimes(1);
  });

  it("refetches after ACCOUNT_UNAVAILABLE so the terminal state shows up", async () => {
    service.connectAccount.mockRejectedValueOnce(
      new RequestError(
        409,
        "账号已被平台停用",
        undefined,
        "ACCOUNT_UNAVAILABLE",
      ),
    );

    const { result } = await setupLoaded();

    await act(() => result.current.onAction("a-off", "reconnect"));

    expect(toast.error).toHaveBeenCalledWith("账号已被平台停用");
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearSession, getAccessToken, setAccessToken } from "@/lib/auth";
import {
  buildUrl,
  configureRequest,
  refreshAccessToken,
  request,
  RequestError,
} from "@/lib/request";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

/** 一个能被 src/lib/auth.ts 解出身份、exp 在很远的将来的 HS256 形状 JWT（不验签，签名段随意）。 */
function makeToken(username: string): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    username,
    role: "admin",
    exp: 4_102_444_800, // 2100-01-01
  })}.sig`;
}

const OLD_TOKEN = makeToken("old");
const NEW_TOKEN = makeToken("new");
const REFRESH_URL = "/api/auth/refresh";

type FetchCall = { url: string; init: RequestInit };

function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization;
}

/**
 * 按 URL / Bearer 分流的 fetch 假实现：refresh 走 `refresh`，其它请求带旧 token 得 401、带新 token 得 200。
 * 每次调用新建 Response（body 只能读一次）。
 */
function stubAuthFetch(refresh: () => Response, replayStatus = 200) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });

    if (url === REFRESH_URL) return Promise.resolve(refresh());

    const bearer = authHeader(init);

    if (bearer === `Bearer ${NEW_TOKEN}`)
      return Promise.resolve(jsonResponse(replayStatus, { ok: true }));

    return Promise.resolve(
      jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "未登录" } }),
    );
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    refreshCalls: () => calls.filter((c) => c.url === REFRESH_URL),
    replayCalls: () =>
      calls.filter((c) => authHeader(c.init) === `Bearer ${NEW_TOKEN}`),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureRequest({ onAuthError: () => {} });
  clearSession();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("buildUrl", () => {
  it("appends only present query params, encoded", () => {
    expect(
      buildUrl("/api/x", { a: "中 文", b: undefined, c: null, d: "", e: 0 }),
    ).toBe("/api/x?a=%E4%B8%AD+%E6%96%87&e=0");
  });
});

describe("request error envelope", () => {
  it("exposes the backend { error: { code, message } } envelope as RequestError.code", async () => {
    stubFetch(
      jsonResponse(409, {
        error: { code: "CAS_CONFLICT", message: "状态已变化", requestId: "r1" },
      }),
    );

    const error = await request("/api/accounts/a/transition", {
      method: "POST",
      retries: 0,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "CAS_CONFLICT",
      message: "状态已变化",
    });
  });

  it("keeps FastAPI-style { detail } working with a null code", async () => {
    stubFetch(jsonResponse(422, { detail: "字段错误" }));

    await expect(request("/api/x", { retries: 0 })).rejects.toMatchObject({
      status: 422,
      code: null,
      message: "字段错误",
    });
  });

  it("falls back to an HTTP message when the body is not JSON", async () => {
    stubFetch(new Response("oops", { status: 502 }));

    await expect(request("/api/x", { retries: 0 })).rejects.toMatchObject({
      status: 502,
      code: null,
      message: "请求失败（HTTP 502）",
    });
  });
});

describe("retries", () => {
  it("does not retry an HTTP error, only a rejected fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { detail: "boom" }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/api/x", { retries: 2 })).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(request("/api/x", { retries: 2 })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("401 refresh (single flight)", () => {
  it("shares one refresh among concurrent 401s and replays each request once with the new token", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });

    const fetches = stubAuthFetch(() =>
      jsonResponse(200, { accessToken: NEW_TOKEN }),
    );

    const results = await Promise.all([
      request("/api/groups", { retries: 0 }),
      request("/api/accounts", { retries: 0 }),
      request("/api/agent-runs", {
        retries: 0,
        method: "POST",
        body: { a: 1 },
      }),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    // 三个 401 只发一次 refresh，它不带 Bearer、带 cookie。
    expect(fetches.refreshCalls()).toHaveLength(1);
    expect(fetches.refreshCalls()[0].init).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(authHeader(fetches.refreshCalls()[0].init)).toBeUndefined();
    // 各重放一次：3 原请求 + 1 refresh + 3 重放。
    expect(fetches.calls).toHaveLength(7);
    expect(
      fetches
        .replayCalls()
        .map((c) => c.url)
        .sort(),
    ).toEqual(["/api/accounts", "/api/agent-runs", "/api/groups"]);
    // 重放保留原方法与请求体。
    expect(
      fetches.replayCalls().find((c) => c.url === "/api/agent-runs")?.init,
    ).toMatchObject({ method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(getAccessToken()).toBe(NEW_TOKEN);
    expect(onAuthError).not.toHaveBeenCalled();
  });

  it("clears the session and calls onAuthError once when the refresh itself fails", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });

    const fetches = stubAuthFetch(() =>
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "refresh token 无效" },
      }),
    );

    const settled = await Promise.allSettled([
      request("/api/groups", { retries: 0 }),
      request("/api/accounts", { retries: 0 }),
      request("/api/agent-runs", { retries: 0 }),
    ]);

    for (const outcome of settled) {
      expect(outcome.status).toBe("rejected");
      expect((outcome as PromiseRejectedResult).reason).toMatchObject({
        status: 401,
      });
    }

    // refresh 自己的 401 不再触发刷新（不递归）：只有 3 原请求 + 1 refresh。
    expect(fetches.refreshCalls()).toHaveLength(1);
    expect(fetches.calls).toHaveLength(4);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("treats a network error during refresh as a failed refresh", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === REFRESH_URL
          ? Promise.reject(new TypeError("Failed to fetch"))
          : Promise.resolve(jsonResponse(401, { detail: "unauthorized" })),
      ),
    );

    await expect(request("/api/groups", { retries: 0 })).rejects.toMatchObject({
      status: 401,
    });
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("gives up (no second refresh) when the replay is still 401", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });

    const fetches = stubAuthFetch(
      () => jsonResponse(200, { accessToken: NEW_TOKEN }),
      401,
    );

    await expect(request("/api/groups", { retries: 0 })).rejects.toMatchObject({
      status: 401,
    });
    // 原请求 + refresh + 重放 = 3，没有第二次 refresh。
    expect(fetches.refreshCalls()).toHaveLength(1);
    expect(fetches.calls).toHaveLength(3);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("does not refresh for a 401 on an auth: false request (login)", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });

    const fetches = stubAuthFetch(() =>
      jsonResponse(200, { accessToken: NEW_TOKEN }),
    );

    await expect(
      request("/api/auth/login", { method: "POST", auth: false, retries: 0 }),
    ).rejects.toMatchObject({ status: 401, message: "未登录" });
    expect(fetches.refreshCalls()).toHaveLength(0);
    expect(onAuthError).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe(OLD_TOKEN);
  });

  it("refreshAccessToken() returns the same in-flight promise and resets afterwards", async () => {
    setAccessToken(OLD_TOKEN);

    const fetches = stubAuthFetch(() =>
      jsonResponse(200, { accessToken: NEW_TOKEN }),
    );

    const first = refreshAccessToken();
    const second = refreshAccessToken();

    expect(second).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(fetches.refreshCalls()).toHaveLength(1);

    // 上一次结束后再调：新的一次刷新。
    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(fetches.refreshCalls()).toHaveLength(2);
  });

  it("refreshAccessToken() fails when the response carries no usable access token", async () => {
    setAccessToken(OLD_TOKEN);

    const onAuthError = vi.fn();

    configureRequest({ onAuthError });
    stubAuthFetch(() => jsonResponse(200, { accessToken: "not-a-jwt" }));

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });
});

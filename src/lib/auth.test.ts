// @vitest-environment jsdom
// 会话边界：decodeAccessToken 是纯函数；set / get / clear 走 jsdom 的内存 sessionStorage，用完清掉。

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canWrite,
  clearSession,
  decodeAccessToken,
  getAccessToken,
  getSession,
  ROLE_LABELS,
  setAccessToken,
  subscribeSession,
} from "@/lib/auth";

function base64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** 造一个形状对的 JWT（签名段随便写：前端只解码不验签）。 */
function makeToken(payload: Record<string, unknown>): string {
  return `${base64Url('{"alg":"HS256","typ":"JWT"}')}.${base64Url(JSON.stringify(payload))}.sig`;
}

// 2026-09-30T00:00:00Z 的 unix 秒；exp 围绕它取
const NOW = 1_790_726_400;

afterEach(() => {
  clearSession();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("decodeAccessToken", () => {
  it("reads username and role from the payload without verifying the signature", () => {
    const token = makeToken({
      sub: "u1",
      username: "admin",
      role: "admin",
      exp: NOW + 900,
    });

    expect(decodeAccessToken(token, NOW)).toEqual({
      username: "admin",
      role: "admin",
    });
  });

  it("decodes base64url payloads with non-ASCII characters", () => {
    const token = makeToken({ username: "观察者", role: "viewer" });

    expect(decodeAccessToken(token, NOW)).toEqual({
      username: "观察者",
      role: "viewer",
    });
  });

  it("treats an expired token as no session", () => {
    const token = makeToken({ username: "admin", role: "admin", exp: NOW });

    expect(decodeAccessToken(token, NOW)).toBeNull();
    expect(decodeAccessToken(token, NOW - 1)).not.toBeNull();
  });

  it("rejects malformed tokens and unknown roles", () => {
    expect(decodeAccessToken("", NOW)).toBeNull();
    expect(decodeAccessToken("a.b", NOW)).toBeNull();
    expect(decodeAccessToken("a.!!!.c", NOW)).toBeNull();
    expect(decodeAccessToken(`a.${base64Url("not json")}.c`, NOW)).toBeNull();
    expect(decodeAccessToken(`a.${base64Url("[1]")}.c`, NOW)).toBeNull();
    expect(
      decodeAccessToken(makeToken({ username: "x", role: "root" }), NOW),
    ).toBeNull();
    expect(decodeAccessToken(makeToken({ role: "admin" }), NOW)).toBeNull();
  });
});

describe("canWrite / ROLE_LABELS", () => {
  it("only admin can write; every role has a label", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
    expect(ROLE_LABELS).toEqual({ admin: "管理员", viewer: "只读" });
  });
});

describe("session store", () => {
  const validToken = makeToken({
    username: "viewer",
    role: "viewer",
    exp: Math.floor(Date.now() / 1000) + 900,
  });

  it("starts empty", () => {
    expect(getAccessToken()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("stores the token in memory, backs it up to sessionStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSession(listener);

    setAccessToken(validToken);

    expect(getAccessToken()).toBe(validToken);
    expect(getSession()).toEqual({ username: "viewer", role: "viewer" });
    expect(window.sessionStorage.getItem("access_token")).toBe(validToken);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    clearSession();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the same session reference across reads", () => {
    setAccessToken(validToken);

    expect(getSession()).toBe(getSession());
  });

  it("restores from the sessionStorage backup after a reload", () => {
    window.sessionStorage.setItem("access_token", validToken);

    expect(getSession()).toEqual({ username: "viewer", role: "viewer" });
    expect(getAccessToken()).toBe(validToken);
  });

  it("drops an expired backup instead of restoring it", () => {
    window.sessionStorage.setItem(
      "access_token",
      makeToken({ username: "viewer", role: "viewer", exp: 1 }),
    );

    expect(getSession()).toBeNull();
    expect(window.sessionStorage.getItem("access_token")).toBeNull();
  });

  it("treats an undecodable token as a cleared session", () => {
    setAccessToken(validToken);
    setAccessToken("garbage");

    expect(getAccessToken()).toBeNull();
    expect(getSession()).toBeNull();
    expect(window.sessionStorage.getItem("access_token")).toBeNull();
  });

  it("clearSession wipes memory and backup, and notifies only when something was cleared", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSession(listener);

    clearSession();
    expect(listener).not.toHaveBeenCalled();

    setAccessToken(validToken);
    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getSession()).toBeNull();
    expect(window.sessionStorage.getItem("access_token")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

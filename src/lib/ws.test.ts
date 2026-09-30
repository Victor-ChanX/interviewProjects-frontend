// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryClient = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));
const getAccessToken = vi.hoisted(() => vi.fn<() => string | null>());
const refreshAccessToken = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("@/lib/query-client", () => ({ queryClient }));
vi.mock("@/lib/auth", () => ({ getAccessToken }));
vi.mock("@/lib/request", () => ({ refreshAccessToken }));

import {
  ACTIVITY_EVENT_TYPES,
  configureRealtime,
  connectRealtime,
  disconnectRealtime,
  getConnectionStatus,
  getLastSeq,
  LAST_SEQ_STORAGE_KEY,
  REALTIME_EVENT_TYPES,
  resetRealtimeForTests,
  subscribeRealtime,
  WS_CLOSE_UNAUTHORIZED,
  type SocketLike,
} from "@/lib/ws";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closed: Array<{ code?: number; reason?: string }> = [];
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed.push({ code, reason });
    this.readyState = 3;
    // 浏览器会在 close() 之后异步派发 close 事件；这里同步派发，测试少一步等待。
    this.onclose?.({ code: code ?? 1000 });
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  push(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  pushRaw(data: unknown) {
    this.onmessage?.({ data });
  }

  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  frames(): unknown[] {
    return this.sent.map((s) => JSON.parse(s) as unknown);
  }
}

const sockets: FakeSocket[] = [];
const HEARTBEAT_MS = 1_000;
const SYNC_SETTLE_MS = 200;

function lastSocket(): FakeSocket {
  const socket = sockets[sockets.length - 1];

  if (!socket) throw new Error("no socket created");

  return socket;
}

/** 建连并走完 open + auth success，返回这条 socket。 */
function connectAndAuth(): FakeSocket {
  connectRealtime();

  const socket = lastSocket();

  socket.open();
  socket.push({ type: "auth", success: true });

  return socket;
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets.length = 0;
  getAccessToken.mockReturnValue("tok");
  refreshAccessToken.mockResolvedValue(false);
  configureRealtime({
    url: "ws://test/ws",
    refreshToken: refreshAccessToken,
    createSocket: (url) => {
      const socket = new FakeSocket(url);

      sockets.push(socket);

      return socket;
    },
    onResync: () => {
      void queryClient.invalidateQueries();
    },
    heartbeatMs: HEARTBEAT_MS,
    backoffBaseMs: 100,
    backoffMaxMs: 1_000,
    syncSettleMs: SYNC_SETTLE_MS,
    random: () => 0,
  });
});

afterEach(() => {
  resetRealtimeForTests();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("auth handshake", () => {
  it("sends the auth frame with the access token and no sinceSeq on a fresh session", () => {
    connectRealtime();

    const socket = lastSocket();

    expect(socket.url).toBe("ws://test/ws");
    expect(getConnectionStatus()).toBe("connecting");

    socket.open();

    expect(socket.frames()).toEqual([{ type: "auth", accessToken: "tok" }]);
    // socket 开了但 auth 还没通过：仍是 connecting。
    expect(getConnectionStatus()).toBe("connecting");

    socket.push({ type: "auth", success: true });

    expect(getConnectionStatus()).toBe("open");
  });

  it("does not open a socket without a token", () => {
    getAccessToken.mockReturnValue(null);
    connectRealtime();

    expect(sockets).toHaveLength(0);
    expect(getConnectionStatus()).toBe("closed");
  });

  it("is idempotent while a socket is alive", () => {
    connectAndAuth();
    connectRealtime();
    connectRealtime();

    expect(sockets).toHaveLength(1);
  });

  it("resumes with the sinceSeq stored in sessionStorage after a reload", () => {
    window.sessionStorage.setItem(LAST_SEQ_STORAGE_KEY, "9");
    connectRealtime();
    lastSocket().open();

    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 9 },
    ]);
  });
});

describe("event frames", () => {
  it("dispatches by type, drops seq <= lastSeq and persists lastSeq", () => {
    const socket = connectAndAuth();
    const seen: number[] = [];

    subscribeRealtime((event) => seen.push(event.seq));

    socket.push({ seq: 5, type: "message", payload: { groupId: "g" } });
    socket.push({ seq: 5, type: "message", payload: { groupId: "g" } });
    socket.push({ seq: 4, type: "message", payload: { groupId: "g" } });
    socket.push({ seq: 6, type: "agent_run", payload: {} });

    expect(seen).toEqual([5, 6]);
    expect(getLastSeq()).toBe(6);
    expect(window.sessionStorage.getItem(LAST_SEQ_STORAGE_KEY)).toBe("6");
  });

  it("survives a bad JSON frame and a throwing handler", () => {
    const socket = connectAndAuth();
    const seen: number[] = [];

    subscribeRealtime(() => {
      throw new Error("boom");
    });
    subscribeRealtime((event) => seen.push(event.seq));
    vi.spyOn(console, "error").mockImplementation(() => {});

    socket.pushRaw("{not json");
    socket.push({ seq: 1, type: "message", payload: {} });
    socket.push({ seq: 2, type: "message", payload: {} });

    expect(seen).toEqual([1, 2]);
  });

  it("unsubscribing stops delivery but keeps the connection", () => {
    const socket = connectAndAuth();
    const seen: number[] = [];
    const unsubscribe = subscribeRealtime((event) => seen.push(event.seq));

    socket.push({ seq: 1, type: "message", payload: {} });
    unsubscribe();
    socket.push({ seq: 2, type: "message", payload: {} });

    expect(seen).toEqual([1]);
    expect(socket.closed).toEqual([]);
    expect(getConnectionStatus()).toBe("open");
  });
});

describe("resync", () => {
  it("invalidates every query when the server reports a replay gap", () => {
    const socket = connectAndAuth();

    socket.push({ type: "resync", sinceSeq: 3, fromSeq: 1003 });

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith();
  });

  it("moves the watermark to fromSeq so the next reconnect does not ask for the same gap again", () => {
    window.sessionStorage.setItem(LAST_SEQ_STORAGE_KEY, "3");
    connectAndAuth();
    lastSocket().push({ type: "resync", sinceSeq: 3, fromSeq: 1003 });

    expect(getLastSeq()).toBe(1003);
    expect(window.sessionStorage.getItem(LAST_SEQ_STORAGE_KEY)).toBe("1003");

    // 服务端从 fromSeq 之后起推：这些帧是新的，照常派发。
    const seen: number[] = [];

    subscribeRealtime((event) => seen.push(event.seq));
    lastSocket().push({ seq: 1004, type: "message", payload: {} });
    expect(seen).toEqual([1004]);

    lastSocket().drop();
    vi.advanceTimersByTime(100);
    lastSocket().open();
    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 1004 },
    ]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });
});

describe("reconnect", () => {
  it("reconnects after backoff and sends the last seq as sinceSeq", () => {
    const first = connectAndAuth();

    first.push({ seq: 7, type: "message", payload: {} });
    first.drop();

    // 非手动断线：已排重连，徽标显示「重连中」而不是「离线」。
    expect(getConnectionStatus()).toBe("reconnecting");
    expect(sockets).toHaveLength(1);

    // 第一次退避 = base * 2^0 = 100ms（random 固定 0，无抖动）。
    vi.advanceTimersByTime(99);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    const second = lastSocket();

    // 重试中的 socket 仍是 reconnecting，不回退成 connecting。
    expect(getConnectionStatus()).toBe("reconnecting");
    second.open();

    expect(second.frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 7 },
    ]);
  });

  it("keeps the first backoff within a second with the production defaults", () => {
    // 题目 B4：重连后 3 秒内出现 —— 首次退避 500ms + 20% 抖动上限 = 600ms。
    configureRealtime({
      backoffBaseMs: 500,
      backoffMaxMs: 30_000,
      random: () => 1,
    });
    connectAndAuth();
    lastSocket().drop();

    vi.advanceTimersByTime(600);
    expect(sockets).toHaveLength(2);
  });

  it("drops replayed frames (seq <= lastSeq) after reconnect and dispatches new ones in order", () => {
    const first = connectAndAuth();
    const seen: number[] = [];

    subscribeRealtime((event) => seen.push(event.seq));
    first.push({ seq: 7, type: "message", payload: {} });
    first.push({ seq: 8, type: "message", payload: {} });
    first.drop();
    vi.advanceTimersByTime(100);

    const second = lastSocket();

    second.open();
    second.push({ type: "auth", success: true });
    // 服务端从 sinceSeq=8 之后补发；lastSentSeq 水位共用，但服务端重试 / 竞争也可能把已推过的重来一遍。
    second.push({ seq: 8, type: "message", payload: {} });
    second.push({ seq: 9, type: "message", payload: {} });
    second.push({ seq: 10, type: "agent_run", payload: {} });
    second.push({ seq: 9, type: "message", payload: {} });
    // 补发完继续实时：顺序不变。
    second.push({ seq: 11, type: "message", payload: {} });

    expect(seen).toEqual([7, 8, 9, 10, 11]);
    expect(getLastSeq()).toBe(11);
  });

  // 前端 #14：只是不推进抛错那一帧的 lastSeq 不够 —— 后面的帧照常把水位推过它，重连不会再补发，
  // 那条事件的效果永久丢失。抛错时按 resync 全量重拉，由 REST 把它的效果带回来。
  it("forces a full resync when a handler throws, so later frames moving lastSeq past it lose nothing", () => {
    const socket = connectAndAuth();
    const seen: number[] = [];
    let failOnce = true;

    subscribeRealtime((event) => {
      if (event.seq === 2 && failOnce) {
        failOnce = false;
        throw new Error("boom");
      }

      seen.push(event.seq);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    socket.push({ seq: 1, type: "message", payload: {} });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();

    socket.push({ seq: 2, type: "message", payload: {} });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith();

    socket.push({ seq: 3, type: "message", payload: {} });

    expect(seen).toEqual([1, 3]);
    // 全量重拉已经兜住 seq 2：水位照常推进，重连从 3 起要补发，不再重复触发重拉。
    expect(getLastSeq()).toBe(3);
    expect(window.sessionStorage.getItem(LAST_SEQ_STORAGE_KEY)).toBe("3");
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);

    socket.drop();
    vi.advanceTimersByTime(100);
    lastSocket().open();

    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 3 },
    ]);
  });

  it("shows syncing while the server replays and settles to open once frames go quiet", () => {
    const first = connectAndAuth();

    first.push({ seq: 3, type: "message", payload: {} });
    first.drop();
    vi.advanceTimersByTime(100);

    const second = lastSocket();

    second.open();
    second.push({ type: "auth", success: true });
    expect(getConnectionStatus()).toBe("syncing");

    vi.advanceTimersByTime(SYNC_SETTLE_MS - 1);
    second.push({ seq: 4, type: "message", payload: {} });
    // 每来一帧安静期重新计时。
    vi.advanceTimersByTime(SYNC_SETTLE_MS - 1);
    expect(getConnectionStatus()).toBe("syncing");
    vi.advanceTimersByTime(1);
    expect(getConnectionStatus()).toBe("open");
  });

  it("goes straight to open when there is nothing to resume", () => {
    connectAndAuth();
    expect(getConnectionStatus()).toBe("open");
    // 首次连上不是「补不回来」：不全量重拉。
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("falls back to a full invalidate when reconnecting without a resume point after having been open", () => {
    // 真机复现（2026-09-30）：页面连上后一条事件都没收到就断线，重连带不了 sinceSeq，
    // 服务端从「现在」起推，断线期间的事件谁也补不回来 → 按 resync 处理。
    connectAndAuth();
    lastSocket().drop();
    vi.advanceTimersByTime(100);
    lastSocket().open();

    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok" },
    ]);

    lastSocket().push({ type: "auth", success: true });

    expect(getConnectionStatus()).toBe("open");
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith();
  });

  it("adopts the seq carried by the auth frame as the resume point", () => {
    connectRealtime();
    lastSocket().open();
    // 服务端在 auth 成功帧里报当前 seq（前向兼容）：不是事件帧，不派发；作为补发点采用。
    const seen: number[] = [];

    subscribeRealtime((event) => seen.push(event.seq));
    lastSocket().push({ type: "auth", success: true, seq: 35 });

    expect(seen).toEqual([]);
    expect(getLastSeq()).toBe(35);
    expect(getConnectionStatus()).toBe("open");

    lastSocket().drop();
    vi.advanceTimersByTime(100);
    lastSocket().open();
    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 35 },
    ]);
    // 有补发点就不需要全量重拉。
    lastSocket().push({ type: "auth", success: true, seq: 35 });
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("grows the delay exponentially up to the cap and resets after auth", () => {
    const first = connectAndAuth();

    first.drop();
    vi.advanceTimersByTime(100); // 2^0 * 100
    lastSocket().drop();
    vi.advanceTimersByTime(199);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1); // 2^1 * 100
    expect(sockets).toHaveLength(3);
    lastSocket().drop();
    vi.advanceTimersByTime(400); // 2^2 * 100
    expect(sockets).toHaveLength(4);
    lastSocket().drop();
    vi.advanceTimersByTime(800); // 2^3 * 100
    expect(sockets).toHaveLength(5);
    lastSocket().drop();
    vi.advanceTimersByTime(1_000); // 2^4 * 100 = 1600 → cap 1000
    expect(sockets).toHaveLength(6);

    // auth 通过后 attempts 归零：下一次断线又从 100ms 开始。
    lastSocket().open();
    lastSocket().push({ type: "auth", success: true });
    lastSocket().drop();
    vi.advanceTimersByTime(100);
    expect(sockets).toHaveLength(7);
  });

  it("does not reconnect after disconnectRealtime() and clears lastSeq", () => {
    const socket = connectAndAuth();

    socket.push({ seq: 3, type: "message", payload: {} });
    disconnectRealtime();

    expect(socket.closed).toEqual([{ code: 1000, reason: "logout" }]);
    expect(getLastSeq()).toBe(0);
    expect(window.sessionStorage.getItem(LAST_SEQ_STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
    expect(getConnectionStatus()).toBe("closed");
  });

  it("reconnects immediately on the online event and does not double up with the backoff timer", () => {
    connectAndAuth();
    lastSocket().push({ seq: 5, type: "message", payload: {} });
    lastSocket().drop();
    vi.advanceTimersByTime(10);
    expect(sockets).toHaveLength(1);

    window.dispatchEvent(new Event("online"));

    expect(sockets).toHaveLength(2);
    expect(getConnectionStatus()).toBe("reconnecting");
    lastSocket().open();
    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok", sinceSeq: 5 },
    ]);

    // 退避定时器已取消，且连接活着时再来 online 也不会另开一条。
    vi.advanceTimersByTime(2_000);
    window.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(2);
  });

  it("reconnects immediately when the tab comes back to the foreground", () => {
    connectAndAuth();
    lastSocket().drop();
    vi.advanceTimersByTime(10);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sockets).toHaveLength(2);
    // 退避定时器已被取消：不会再开第三条。
    vi.advanceTimersByTime(2_000);
    expect(sockets).toHaveLength(2);
  });
});

describe("heartbeat", () => {
  it("pings every interval and closes the socket when nothing comes back", () => {
    const socket = connectAndAuth();

    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(socket.frames()).toEqual([
      { type: "auth", accessToken: "tok" },
      { type: "ping" },
    ]);

    socket.push({ type: "pong" });
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(socket.frames()).toHaveLength(3);
    expect(socket.closed).toEqual([]);

    // 这个周期一帧都没收到：视为半开，主动关闭并排重连。
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(socket.closed).toEqual([
      { code: 4000, reason: "heartbeat timeout" },
    ]);
    expect(getConnectionStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(100);
    expect(sockets).toHaveLength(2);
  });
});

describe("unauthorized (4401) → refresh", () => {
  /** 让 refreshToken 的 Promise 回调跑完（假时钟下用 advanceTimersByTimeAsync 冲微任务）。 */
  const flush = () => vi.advanceTimersByTimeAsync(0);

  it("refreshes the token once and reconnects immediately with the new one", async () => {
    refreshAccessToken.mockImplementation(() => {
      getAccessToken.mockReturnValue("tok2");

      return Promise.resolve(true);
    });
    connectAndAuth();
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);

    // 刷新进行中：徽标是「重连中」，还没开新 socket。
    expect(getConnectionStatus()).toBe("reconnecting");
    expect(sockets).toHaveLength(1);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    await flush();

    // 不等退避，刷新一成功就重连，认证帧带新 token。
    expect(sockets).toHaveLength(2);
    lastSocket().open();
    expect(lastSocket().frames()).toEqual([
      { type: "auth", accessToken: "tok2" },
    ]);
    lastSocket().push({ type: "auth", success: true });
    expect(getConnectionStatus()).toBe("open");

    // 认证通过后再被拒：允许再刷一次（不是一辈子只刷一次）。
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(sockets).toHaveLength(3);
  });

  it("stops (closed, no reconnect) when the refresh fails", async () => {
    connectAndAuth();
    lastSocket().push({ type: "auth", success: false, code: "UNAUTHORIZED" });
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);
    await flush();

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(getConnectionStatus()).toBe("closed");

    // 退避定时器 / 回前台都不再重连。
    vi.advanceTimersByTime(10_000);
    window.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(1);

    // 重新登录后显式 connectRealtime() 才再连。
    connectRealtime();
    expect(sockets).toHaveLength(2);
  });

  it("does not refresh a second time when the reconnected socket is rejected again", async () => {
    refreshAccessToken.mockResolvedValue(true);
    connectAndAuth();
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);
    await flush();
    expect(sockets).toHaveLength(2);

    // 新 token 也被拒：不再刷、不再连，否则两个坏 token 会互相触发循环。
    lastSocket().open();
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);
    await flush();
    vi.advanceTimersByTime(10_000);

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    expect(getConnectionStatus()).toBe("closed");
  });

  it("treats an auth failure frame as unauthorized even when the close code is not 4401", async () => {
    connectRealtime();
    lastSocket().open();
    lastSocket().push({ type: "auth", success: false, code: "UNAUTHORIZED" });
    lastSocket().drop(1006);
    await flush();

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
    expect(getConnectionStatus()).toBe("closed");
  });

  it("does not reconnect while the refresh is pending, and honours a logout during it", async () => {
    let resolveRefresh: (ok: boolean) => void = () => {};

    refreshAccessToken.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    connectAndAuth();
    lastSocket().drop(WS_CLOSE_UNAUTHORIZED);

    // 回前台 / online 不能抢在新 token 就位前用旧 token 重连。
    window.dispatchEvent(new Event("online"));
    expect(sockets).toHaveLength(1);

    disconnectRealtime();
    resolveRefresh(true);
    await flush();

    // 刷新期间登出：结果作废，不重连。
    expect(sockets).toHaveLength(1);
    expect(getConnectionStatus()).toBe("closed");
  });
});

describe("event types", () => {
  it("knows inconsistency_resolved but keeps it out of the activity feed", () => {
    expect(REALTIME_EVENT_TYPES).toContain("inconsistency_resolved");
    expect(ACTIVITY_EVENT_TYPES).not.toContain("inconsistency_resolved");
    expect(ACTIVITY_EVENT_TYPES).toHaveLength(REALTIME_EVENT_TYPES.length - 1);
  });
});

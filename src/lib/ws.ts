// 实时事件连接：整个应用只有这一处 new WebSocket（frontend-realtime-events）。
//
// 协议（后端 src/api/routes/ws.ts + src/services/ws-hub.ts）：
// - 连接后第一帧 `{ type: "auth", accessToken, sinceSeq? }`；通过回 `{ type: "auth", success: true }`，
//   这时才算 status = "open"；失败回 `{ type: "auth", success: false }` 并以 4401 关闭。
// - 事件帧 `{ seq, type, payload }`，seq 全局单调；按 seq 去重（<= lastSeq 的丢弃），
//   lastSeq 存模块内存 + sessionStorage，重连 / 刷新时作为 sinceSeq 带上让服务端补发。
//   不带 sinceSeq（lastSeq 为 0）时服务端从「现在」起推，之前的状态由 REST 拉。
//   补发帧与实时帧走同一条 dispatch → 订阅者路径（题目 B4：断线期间的事件重连后出现且不重复），
//   所以每个订阅者的 handler 必须幂等：同一事件重放只能得到同一份缓存。
//   handler 抛错的那一帧不能指望补发：只是不推进它的 lastSeq 没用，后面的帧照常把水位推过它，
//   重连时 sinceSeq 已在它之后（前端 #14）。所以抛错时按 resync 兜底 —— 全量 invalidateQueries，
//   由 REST 把这一帧的效果带回来 —— 然后照常推进 lastSeq。
// - `{ type: "resync", sinceSeq, fromSeq }`：补发窗口已过、(sinceSeq, fromSeq] 之间有缺口 →
//   全量 invalidateQueries，并把 lastSeq 推到 fromSeq（服务端从那里起推；不推进的话下一次
//   重连又带着旧 sinceSeq 去要，每次都 resync、每次都全量重拉）。
// - 没有补发点的重连：这一页从连上起一条事件都没收到过（lastSeq 仍是 0）就断了线，重连时带不了
//   sinceSeq，服务端只会从「现在」起推，断线期间的事件谁也补不回来 —— 这时按 resync 处理，
//   全量重拉一次让 REST 把断线期间的变化带回来（2026-09-30 真机复现：开着群详情 kill 后端、
//   curl 发两条再拉起，徽标回到「实时」但消息不出现，原因就是这个）。
//   服务端若在 auth 成功帧里带当前 `seq`（`{ type: "auth", success: true, seq }`），这里直接把它当
//   补发点采用，之后的重连就能真正补发而不用全量重拉；后端还没带时这条路径自动不生效。
// - 心跳：每 heartbeatMs 发 `{ type: "ping" }`，服务端回 `{ type: "pong" }`；一个周期内
//   没收到任何帧就主动 close() 触发重连（半开连接浏览器不会自己报 close）。
// - 重连：指数退避（500ms 起、上限 30s、带抖动 —— 首次 ≤ 600ms，给 B4「3 秒内」留足余量），
//   auth 通过后归零；回前台 / online 立即重连；disconnectRealtime()（登出）不重连并清 lastSeq。
// - 认证被拒（auth 失败帧 / 4401 关闭）：多半是 access token 过期 —— 先调请求层的单飞
//   refreshAccessToken()（与 HTTP 401 共用同一个 Promise，不另写刷新），成功就立即用新 token 重连一次；
//   刷新失败（请求层已清会话、走 onAuthError）或重连后再次被拒才停止（status = closed），
//   等重新登录后由 connectRealtime() 再连。「每次认证通过后才允许再刷一次」挡住两个坏 token 互相触发的循环。
// - 状态给壳上的徽标用：reconnecting = 断线且已排重连（含重试中的 socket）；syncing = 带 sinceSeq
//   重连成功、服务端正在补发 —— 补发没有结束帧，事件帧安静 syncSettleMs 后才算 open。
// - 可注入 WebSocket 构造器与时钟：测试用假 socket 推帧，断言发出的帧与缓存变化。
//
// 事件 seq 跳号不当作丢帧：ws_events.seq 是 PG 序列，事务回滚会留下合法的空号。

import { getAccessToken } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import { refreshAccessToken } from "@/lib/request";
import type { components } from "@/types/api.generated";

export interface RealtimeEvent<T = unknown> {
  seq: number;
  type: string;
  payload: T;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

/**
 * connecting = 首次建连，socket 已开但 auth 未通过；reconnecting = 断线后在退避 / 重试中；
 * syncing = 带 sinceSeq 重连成功、服务端补发中；open = 实时；closed = 不再重连（登出 / 认证被拒 / 无 token）。
 */
export type ConnectionStatus =
  "idle" | "connecting" | "reconnecting" | "syncing" | "open" | "closed";

// ---- 事件 payload（后端 src/services/ws-events.ts 的注释是契约；WS 帧不在 openapi 里，派生不了，手写）----

export type MessageEventPayload = {
  groupId: string;
  /** 自己发的消息 queued 时还没有 msgId；群不可写而取消的出站消息也是 null。 */
  msgId: string | null;
  isOwn: boolean;
  clientMsgId?: string | null;
  deliveryStatus?: components["schemas"]["DeliveryStatus"] | null;
  failCode?: string | null;
  /**
   * 这条消息当前的 sentAt（ISO）。自己的消息排队时是受理时刻、发出后变成网关时刻，时间线据此挪位置；
   * 可选：不带时位置等下一次最新页补拉再纠正（前端 #17）。
   */
  sentAt?: string | null;
};

export type AgentRunEventPayload = {
  runId: string;
  groupId: string;
  status: components["schemas"]["AgentRunStatus"];
  endReason: components["schemas"]["AgentRunEndReason"] | null;
};

export type GroupStatusChangedEventPayload = {
  groupId: string;
  from: components["schemas"]["GroupStatus"];
  to: components["schemas"]["GroupStatus"];
  reason: string;
};

export type GroupSettingsChangedEventPayload = {
  groupId: string;
  agentEnabled: boolean;
  autoKickEnabled: boolean;
};

/** 不一致记录被标记为已处理（后端 #22；只在「未处理 → 已处理」那一次推）。操作回执，不进动态流。 */
export type InconsistencyResolvedEventPayload = {
  id: string;
  resolvedAt: string;
  resolvedBy: string;
};

/**
 * 后端推的全部事件 type（后端 src/services/ws-events.ts 的 WS_EVENT_TYPES，同一份契约）。
 * 除 inconsistency_resolved 外都进「实时动态」（GET /api/activity 的白名单同口径）。
 */
export const REALTIME_EVENT_TYPES = [
  "account_status_changed",
  "account_terminal",
  "inconsistency",
  "message",
  "agent_run",
  "sequence_run",
  "member_changed",
  "group_status_changed",
  "group_settings_changed",
  "job",
  "inconsistency_resolved",
] as const;

type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

/** 进「实时动态」的事件 type：操作回执（inconsistency_resolved）不进。 */
export const ACTIVITY_EVENT_TYPES: readonly RealtimeEventType[] =
  REALTIME_EVENT_TYPES.filter((type) => type !== "inconsistency_resolved");

/** 只用到的那一小片 WebSocket 接口，方便测试注入假实现。 */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export interface RealtimeConfig {
  /** ws(s):// 地址；默认 VITE_WS_URL，没有就由当前页面 origin 推出 /ws。 */
  url: string;
  /** 取 access token；返回 null 表示未登录，不建连。 */
  getToken: () => string | null;
  /** 认证被拒时的续期（请求层的单飞刷新）：true = 新 token 已就位，可以重连。 */
  refreshToken: () => Promise<boolean>;
  createSocket: SocketFactory;
  /** 收到 resync（补发有缺口）时的全量重拉。 */
  onResync: () => void;
  heartbeatMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  /** 补发中（syncing）连续这么久没有事件帧就视为补完、转 open。 */
  syncSettleMs: number;
  random: () => number;
}

export const LAST_SEQ_STORAGE_KEY = "realtime:lastSeq";

/** 服务端认证失败 / 认证超时的 close code。 */
export const WS_CLOSE_UNAUTHORIZED = 4401;

const OPEN = 1;

function defaultUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;

  if (configured) return configured;

  if (typeof window === "undefined") return "";

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${proto}//${window.location.host}/ws`;
}

function defaultSocket(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

function readStoredSeq(): number {
  try {
    const raw = window.sessionStorage.getItem(LAST_SEQ_STORAGE_KEY);
    const parsed = raw === null ? 0 : Number(raw);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function storeSeq(seq: number): void {
  try {
    if (seq > 0)
      window.sessionStorage.setItem(LAST_SEQ_STORAGE_KEY, String(seq));
    else window.sessionStorage.removeItem(LAST_SEQ_STORAGE_KEY);
  } catch {
    // sessionStorage 不可用时只靠内存；整页刷新会从 0 开始（服务端从「现在」起推，页面靠 REST 拉现状）。
  }
}

const config: RealtimeConfig = {
  url: "",
  getToken: getAccessToken,
  refreshToken: refreshAccessToken,
  createSocket: defaultSocket,
  onResync: () => {
    void queryClient.invalidateQueries();
  },
  heartbeatMs: 25_000,
  backoffBaseMs: 500,
  backoffMaxMs: 30_000,
  syncSettleMs: 500,
  random: Math.random,
};

let socket: SocketLike | null = null;
let status: ConnectionStatus = "idle";
let lastSeq = 0;
let seqLoaded = false;
let attempts = 0;
let manuallyClosed = false;
/** 认证被拒且不再尝试（刷新失败 / 刷新后仍被拒）：不重连，等下次 connectRealtime()。 */
let authRejected = false;
/** 这条 socket 上收到过 auth 失败帧：服务端随后关闭时（哪怕 code 不是 4401）按认证被拒处理。 */
let authFailedFrame = false;
/** 上次认证通过以来已经刷新过一次 token：再被拒就不刷了，两个坏 token 互相触发会无限循环。 */
let refreshTried = false;
/** 刷新进行中：回前台 / online 不要抢在新 token 就位前用旧 token 重连。 */
let refreshPending = false;
let awaitingPong = false;
let windowListenersBound = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let syncSettleTimer: ReturnType<typeof setTimeout> | null = null;
/** 这一页里 auth 通过过至少一次：之后没有补发点的重连要全量重拉。 */
let everAuthenticated = false;
const listeners = new Set<RealtimeListener>();
const statusListeners = new Set<(status: ConnectionStatus) => void>();

/** 应用启动时配置一次（地址、token 来源）；测试里注入 createSocket / random。 */
export function configureRealtime(next: Partial<RealtimeConfig>): void {
  Object.assign(config, next);
}

export function getLastSeq(): number {
  return lastSeq;
}

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

function setStatus(next: ConnectionStatus): void {
  if (status === next) return;

  status = next;

  for (const listener of statusListeners) listener(next);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) clearInterval(heartbeatTimer);

  heartbeatTimer = null;
  awaitingPong = false;
}

function stopSyncSettle(): void {
  if (syncSettleTimer !== null) clearTimeout(syncSettleTimer);

  syncSettleTimer = null;
}

/** 补发中：每来一帧就把「安静期」重新计时，到点转 open。 */
function touchSyncSettle(ws: SocketLike): void {
  stopSyncSettle();
  syncSettleTimer = setTimeout(() => {
    syncSettleTimer = null;

    if (socket === ws && status === "syncing") setStatus("open");
  }, config.syncSettleMs);
}

function startHeartbeat(ws: SocketLike): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket !== ws || ws.readyState !== OPEN) return;

    // 上一个周期发了 ping 却一帧都没收到：连接已半开，主动关掉让 onclose 走重连。
    if (awaitingPong) {
      ws.close(4000, "heartbeat timeout");

      return;
    }

    awaitingPong = true;
    ws.send(JSON.stringify({ type: "ping" }));
  }, config.heartbeatMs);
}

function backoffDelay(): number {
  const exp = Math.min(
    config.backoffMaxMs,
    config.backoffBaseMs * 2 ** attempts,
  );
  const jitter = config.random() * exp * 0.2;

  return Math.min(config.backoffMaxMs, exp + jitter);
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);

  reconnectTimer = null;
}

function scheduleReconnect(): void {
  if (manuallyClosed || authRejected || reconnectTimer !== null) return;

  const delay = backoffDelay();

  attempts += 1;
  setStatus("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

/** 回前台 / 网络恢复：跳过退避等待立即重连。 */
function reconnectNow(): void {
  if (manuallyClosed || authRejected || refreshPending || socket !== null)
    return;

  clearReconnectTimer();
  openSocket();
}

function bindWindowListeners(): void {
  if (windowListenersBound || typeof window === "undefined") return;

  windowListenersBound = true;
  window.addEventListener("online", reconnectNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconnectNow();
  });
}

type ControlFrame =
  | { type: "auth"; success: boolean; seq?: number }
  | { type: "pong" }
  | { type: "resync"; sinceSeq: number; fromSeq: number };

type Frame =
  | { kind: "event"; event: RealtimeEvent }
  | { kind: "control"; frame: ControlFrame }
  | null;

function parseFrame(data: unknown): Frame {
  if (typeof data !== "string") return null;

  let raw: unknown;

  try {
    raw = JSON.parse(data);
  } catch {
    // 一帧坏 JSON 只跳过这一帧，不让后续帧全丢。
    return null;
  }

  if (!raw || typeof raw !== "object") return null;

  const frame = raw as Partial<RealtimeEvent> & Record<string, unknown>;
  const { seq, type, payload } = frame;

  if (typeof type !== "string") return null;

  // 控制帧先于事件帧判断：auth 成功帧将来可能带当前 seq，不能因此被当成事件。
  if (type === "auth")
    return {
      kind: "control",
      frame: {
        type,
        success: frame.success === true,
        ...(typeof seq === "number" ? { seq } : {}),
      },
    };

  if (type === "pong") return { kind: "control", frame: { type } };

  if (type === "resync")
    return {
      kind: "control",
      frame: {
        type,
        sinceSeq: Number(frame.sinceSeq),
        fromSeq: Number(frame.fromSeq),
      },
    };

  if (typeof seq === "number")
    return { kind: "event", event: { seq, type, payload } };

  return null;
}

function advanceSeq(seq: number): void {
  if (!Number.isFinite(seq) || seq <= lastSeq) return;

  lastSeq = seq;
  storeSeq(lastSeq);
}

function dispatch(event: RealtimeEvent): void {
  // 按 seq 去重：补发与正常推送可能重叠，只有比 lastSeq 大的才算新事件。
  if (event.seq <= lastSeq) return;

  let failed = false;

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      failed = true;
      console.error("realtime handler failed", event.type, error);
    }
  }

  // 有 handler 抛错：这一帧的效果没进缓存，也等不到补发 —— 下一帧就会把 lastSeq 推过它，
  // 重连时服务端从更后面补起。按 resync 全量重拉兜底，REST 返回的是包含这一帧效果的现状。
  if (failed) config.onResync();

  advanceSeq(event.seq);
}

function handleControl(
  ws: SocketLike,
  frame: ControlFrame,
  resumedFrom: number,
): void {
  switch (frame.type) {
    case "auth":
      if (frame.success) {
        attempts = 0;
        // 认证通过：下次再被拒时允许再刷一次。
        refreshTried = false;
        startHeartbeat(ws);

        // 服务端报了当前 seq：作为补发点采用，之后断线就能真正补发。
        if (frame.seq !== undefined) advanceSeq(frame.seq);

        if (resumedFrom > 0) {
          // 带了 sinceSeq：服务端正在补发（紧跟在 auth 帧之后、同一条 socket 上按 seq 顺序到达）。
          setStatus("syncing");
          touchSyncSettle(ws);
        } else {
          // 之前连上过却拿不出补发点（从没收到过事件）：断线期间的事件补不回来，按 resync 全量重拉。
          if (everAuthenticated) config.onResync();

          setStatus("open");
        }

        everAuthenticated = true;
      } else {
        // 服务端随后会以 4401 关闭；这里先标记，onclose 按「认证被拒」走刷新 / 停止，不排退避重连。
        authFailedFrame = true;
      }

      break;
    case "resync":
      // (sinceSeq, fromSeq] 之间的事件不再补发：缓存里可能缺状态，全量重拉；
      // 水位跟着服务端走到 fromSeq，下次重连不再拿旧 sinceSeq 去要同一段缺口。
      advanceSeq(frame.fromSeq);
      config.onResync();
      break;
    case "pong":
      break;
  }
}

function loadStoredSeq(): void {
  if (seqLoaded || typeof window === "undefined") return;

  seqLoaded = true;
  lastSeq = Math.max(lastSeq, readStoredSeq());
}

function openSocket(): void {
  if (socket !== null) return;

  const token = config.getToken();

  if (!token) {
    setStatus("closed");

    return;
  }

  loadStoredSeq();
  manuallyClosed = false;
  // 重试中的 socket 仍算「重连中」，徽标不在 重连中 / 连接中 之间来回跳。
  setStatus(attempts > 0 ? "reconnecting" : "connecting");

  let ws: SocketLike;

  try {
    ws = config.createSocket(config.url || defaultUrl());
  } catch (error) {
    // 构造器抛错（地址非法、被扩展拦截）也走退避重连，而不是让定时器回调把异常抛到顶层。
    console.error("realtime socket failed to open", error);
    scheduleReconnect();

    return;
  }

  socket = ws;

  // 这条 socket 的认证帧带的 sinceSeq：> 0 表示服务端会先补发，auth 通过后进入 syncing。
  const resumedFrom = lastSeq;

  ws.onopen = () => {
    if (socket !== ws) return;

    // 认证帧带 sinceSeq（有才带）：服务端据此补发断线期间的事件；0 表示新会话，从「现在」起推。
    ws.send(
      JSON.stringify({
        type: "auth",
        accessToken: token,
        ...(resumedFrom > 0 ? { sinceSeq: resumedFrom } : {}),
      }),
    );
  };

  ws.onmessage = ({ data }) => {
    if (socket !== ws) return;

    awaitingPong = false;

    const frame = parseFrame(data);

    if (!frame) return;

    if (frame.kind === "event") {
      if (status === "syncing") touchSyncSettle(ws);

      dispatch(frame.event);
    } else handleControl(ws, frame.frame, resumedFrom);
  };

  ws.onerror = () => {
    // 错误之后浏览器必然触发 close，重连统一在 onclose 里排。
  };

  ws.onclose = (event) => {
    if (socket !== ws) return;

    stopHeartbeat();
    stopSyncSettle();
    socket = null;

    const unauthorized =
      event?.code === WS_CLOSE_UNAUTHORIZED || authFailedFrame;

    authFailedFrame = false;

    if (manuallyClosed || authRejected) setStatus("closed");
    else if (unauthorized) handleUnauthorized();
    // 非手动关闭 → 排退避重连，状态是 reconnecting；登出 / 认证被拒才是 closed。
    else scheduleReconnect();
  };
}

/**
 * 认证被拒：这次认证通过以来还没刷过 → 单飞刷新，成功立即重连（新 token 由 getToken 重新取）；
 * 已经刷过一次、或刷新失败（请求层已清会话并走 onAuthError）→ 停止，等重新登录。
 */
function handleUnauthorized(): void {
  if (refreshTried) {
    authRejected = true;
    setStatus("closed");

    return;
  }

  refreshTried = true;
  refreshPending = true;
  setStatus("reconnecting");

  void config
    .refreshToken()
    .catch(() => false)
    .then((refreshed) => {
      refreshPending = false;

      // 刷新期间登出了 / 重新登录后已另开连接：什么都不做。
      if (manuallyClosed || socket !== null) return;

      if (refreshed) {
        openSocket();
      } else {
        authRejected = true;
        setStatus("closed");
      }
    });
}

/**
 * 建连（幂等：已连 / 连接中直接返回）。登录态就绪时由应用壳调一次；
 * 重新登录后再调一次会清掉上次的「认证被拒」标记。
 */
export function connectRealtime(): void {
  if (typeof window === "undefined") return;

  authRejected = false;
  refreshTried = false;
  manuallyClosed = false;
  bindWindowListeners();
  clearReconnectTimer();
  openSocket();
}

/** 订阅事件。返回退订函数 —— 退订不断开连接；连接本身由 connectRealtime() 管。 */
export function subscribeRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function subscribeConnectionStatus(
  listener: (status: ConnectionStatus) => void,
): () => void {
  statusListeners.add(listener);

  return () => {
    statusListeners.delete(listener);
  };
}

/** 登出时主动断开：不重连、清 lastSeq（下个账号从 0 开始，不带旧序号去要补发）。 */
export function disconnectRealtime(): void {
  manuallyClosed = true;
  clearReconnectTimer();
  stopHeartbeat();
  stopSyncSettle();

  const ws = socket;

  socket = null;
  ws?.close(1000, "logout");
  lastSeq = 0;
  attempts = 0;
  everAuthenticated = false;
  storeSeq(0);
  setStatus("closed");
}

/** 测试用：重置模块状态（不碰 config）。 */
export function resetRealtimeForTests(): void {
  disconnectRealtime();
  listeners.clear();
  statusListeners.clear();
  status = "idle";
  manuallyClosed = false;
  authRejected = false;
  authFailedFrame = false;
  refreshTried = false;
  refreshPending = false;
  seqLoaded = false;
}

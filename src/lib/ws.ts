// 实时事件连接：整个应用只有这一处 new WebSocket（frontend-realtime-events）。
//
// 协议（后端 src/api/routes/ws.ts + src/services/ws-hub.ts）：
// - 连接后第一帧 `{ type: "auth", accessToken, sinceSeq? }`；通过回 `{ type: "auth", success: true }`，
//   这时才算 status = "open"；失败回 `{ type: "auth", success: false }` 并以 4401 关闭。
// - 事件帧 `{ seq, type, payload }`，seq 全局单调；按 seq 去重（<= lastSeq 的丢弃），
//   lastSeq 存模块内存 + sessionStorage，重连 / 刷新时作为 sinceSeq 带上让服务端补发。
//   不带 sinceSeq（lastSeq 为 0）时服务端从「现在」起推，之前的状态由 REST 拉。
// - `{ type: "resync", sinceSeq, fromSeq }`：补发窗口已过、中间有缺口 → 全量 invalidateQueries。
// - 心跳：每 heartbeatMs 发 `{ type: "ping" }`，服务端回 `{ type: "pong" }`；一个周期内
//   没收到任何帧就主动 close() 触发重连（半开连接浏览器不会自己报 close）。
// - 重连：指数退避（500ms 起、上限 30s、带抖动），auth 通过后归零；回前台 / online 立即重连；
//   disconnectRealtime()（登出）不重连并清 lastSeq。认证被拒（4401）也不重连：token 已失效，
//   等重新登录后由 connectRealtime() 再连（单飞 refresh 随后端 auth 一起落地后在这里接）。
// - 可注入 WebSocket 构造器与时钟：测试用假 socket 推帧，断言发出的帧与缓存变化。
//
// 事件 seq 跳号不当作丢帧：ws_events.seq 是 PG 序列，事务回滚会留下合法的空号。

import { getAccessToken } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";
import type { components } from "@/types/api.generated";

export interface RealtimeEvent<T = unknown> {
  seq: number;
  type: string;
  payload: T;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

/** connecting = socket 已开但 auth 未通过；open = 收到 auth success。 */
export type ConnectionStatus = "idle" | "connecting" | "open" | "closed";

// ---- 事件 payload（后端 src/services/ws-events.ts 的注释是契约；WS 帧不在 openapi 里，派生不了，手写）----

export type MessageEventPayload = {
  groupId: string;
  /** 自己发的消息 queued 时还没有 msgId；群不可写而取消的出站消息也是 null。 */
  msgId: string | null;
  isOwn: boolean;
  clientMsgId?: string | null;
  deliveryStatus?: components["schemas"]["DeliveryStatus"] | null;
  failCode?: string | null;
};

export type AgentRunEventPayload = {
  runId: string;
  groupId: string;
  status: components["schemas"]["AgentRunStatus"];
  endReason: components["schemas"]["AgentRunEndReason"] | null;
};

export type MemberChangedEventPayload = {
  groupId: string;
  platformUserId: string;
  accountId: string | null;
  change: "joined" | "left" | "promoted";
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
  createSocket: SocketFactory;
  /** 收到 resync（补发有缺口）时的全量重拉。 */
  onResync: () => void;
  heartbeatMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
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
  createSocket: defaultSocket,
  onResync: () => {
    void queryClient.invalidateQueries();
  },
  heartbeatMs: 25_000,
  backoffBaseMs: 500,
  backoffMaxMs: 30_000,
  random: Math.random,
};

let socket: SocketLike | null = null;
let status: ConnectionStatus = "idle";
let lastSeq = 0;
let seqLoaded = false;
let attempts = 0;
let manuallyClosed = false;
let authRejected = false;
let awaitingPong = false;
let windowListenersBound = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

/** 回前台 / 网络恢复：跳过退避等待立即重连。 */
function reconnectNow(): void {
  if (manuallyClosed || authRejected || socket !== null) return;

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
  | { type: "auth"; success: boolean }
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

  if (typeof seq === "number")
    return { kind: "event", event: { seq, type, payload } };

  if (type === "auth")
    return {
      kind: "control",
      frame: { type, success: frame.success === true },
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

  return null;
}

function dispatch(event: RealtimeEvent): void {
  // 按 seq 去重：补发与正常推送可能重叠，只有比 lastSeq 大的才算新事件。
  if (event.seq <= lastSeq) return;

  // 先推进后处理：handler 抛错也不会让这一条被重复处理。
  lastSeq = event.seq;
  storeSeq(lastSeq);

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("realtime handler failed", event.type, error);
    }
  }
}

function handleControl(ws: SocketLike, frame: ControlFrame): void {
  switch (frame.type) {
    case "auth":
      if (frame.success) {
        attempts = 0;
        setStatus("open");
        startHeartbeat(ws);
      } else {
        // 服务端随后会以 4401 关闭；这里先标记，onclose 就不再排重连。
        authRejected = true;
      }

      break;
    case "resync":
      // (sinceSeq, fromSeq] 之间的事件不再补发：缓存里可能缺状态，全量重拉。
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
  setStatus("connecting");

  const ws = config.createSocket(config.url || defaultUrl());

  socket = ws;

  ws.onopen = () => {
    if (socket !== ws) return;

    // 认证帧带 sinceSeq（有才带）：服务端据此补发断线期间的事件；0 表示新会话，从「现在」起推。
    ws.send(
      JSON.stringify({
        type: "auth",
        accessToken: token,
        ...(lastSeq > 0 ? { sinceSeq: lastSeq } : {}),
      }),
    );
  };

  ws.onmessage = ({ data }) => {
    if (socket !== ws) return;

    awaitingPong = false;

    const frame = parseFrame(data);

    if (!frame) return;

    if (frame.kind === "event") dispatch(frame.event);
    else handleControl(ws, frame.frame);
  };

  ws.onerror = () => {
    // 错误之后浏览器必然触发 close，重连统一在 onclose 里排。
  };

  ws.onclose = (event) => {
    if (socket !== ws) return;

    stopHeartbeat();
    socket = null;
    setStatus("closed");

    if (event?.code === WS_CLOSE_UNAUTHORIZED) authRejected = true;

    scheduleReconnect();
  };
}

/**
 * 建连（幂等：已连 / 连接中直接返回）。登录态就绪时由应用壳调一次；
 * 重新登录后再调一次会清掉上次的「认证被拒」标记。
 */
export function connectRealtime(): void {
  if (typeof window === "undefined") return;

  authRejected = false;
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

  const ws = socket;

  socket = null;
  ws?.close(1000, "logout");
  lastSeq = 0;
  attempts = 0;
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
  seqLoaded = false;
}

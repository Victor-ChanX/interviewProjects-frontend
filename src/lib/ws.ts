// 实时事件连接：整个应用只有这一处 new WebSocket（frontend-realtime-events）。
//
// - 单例：第一个订阅者触发连接，之后的订阅共用；组件卸载只退订，不断连接。
// - 认证帧：open 后先发 { type: "auth", token, sinceSeq }，服务端据 sinceSeq 补发断线期间的事件。
// - 事件帧 { seq, type, payload }：按 seq 去重（<= lastSeq 的丢弃），lastSeq 存模块内存 + sessionStorage。
// - 重连：指数退避（500ms 起、上限 30s、带抖动），页面主动 close() 不重连。
// - 心跳：每 25s 发 { type: "ping" }，服务端 pong 只用于保活，不算事件。
// - 可注入 WebSocket 构造器：测试用假 socket 推帧，断言缓存变化。

export interface RealtimeEvent<T = unknown> {
  seq: number;
  type: string;
  payload: T;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed";

/** 只用到的那一小片 WebSocket 接口，方便测试注入假实现。 */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

export interface RealtimeConfig {
  /** ws(s):// 地址；默认由当前页面 origin 推出。 */
  url: string;
  /** 取 access token；返回 null 表示未登录，不建连。 */
  getToken: () => string | null;
  createSocket: SocketFactory;
  heartbeatMs: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

const LAST_SEQ_KEY = "realtime:lastSeq";
const OPEN = 1;

function defaultUrl(): string {
  if (typeof window === "undefined") return "";

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${proto}//${window.location.host}/ws`;
}

function defaultSocket(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

function readStoredSeq(): number {
  try {
    const raw = window.sessionStorage.getItem(LAST_SEQ_KEY);
    const parsed = raw === null ? 0 : Number(raw);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function storeSeq(seq: number): void {
  try {
    window.sessionStorage.setItem(LAST_SEQ_KEY, String(seq));
  } catch {
    // sessionStorage 不可用时只靠内存；下次整页刷新会从 0 开始（服务端全量补发）。
  }
}

const config: RealtimeConfig = {
  url: "",
  getToken: () => null,
  createSocket: defaultSocket,
  heartbeatMs: 25_000,
  backoffBaseMs: 500,
  backoffMaxMs: 30_000,
};

let socket: SocketLike | null = null;
let status: ConnectionStatus = "idle";
let lastSeq = 0;
let attempts = 0;
let manuallyClosed = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<RealtimeListener>();
const statusListeners = new Set<(status: ConnectionStatus) => void>();

/** 应用启动时配置一次（token 来源、地址）；测试里注入 createSocket。 */
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
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket?.readyState === OPEN)
      socket.send(JSON.stringify({ type: "ping" }));
  }, config.heartbeatMs);
}

function backoffDelay(): number {
  const exp = Math.min(
    config.backoffMaxMs,
    config.backoffBaseMs * 2 ** attempts,
  );
  const jitter = Math.random() * exp * 0.2;

  return Math.min(config.backoffMaxMs, exp + jitter);
}

function scheduleReconnect(): void {
  if (manuallyClosed || reconnectTimer !== null) return;

  const delay = backoffDelay();

  attempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

function parseFrame(data: unknown): RealtimeEvent | null {
  if (typeof data !== "string") return null;

  try {
    const frame: unknown = JSON.parse(data);

    if (!frame || typeof frame !== "object") return null;

    const { seq, type, payload } = frame as Partial<RealtimeEvent>;

    if (typeof type !== "string") return null;

    // 控制帧（pong / auth-ok）没有 seq，不进事件流。
    if (typeof seq !== "number") return null;

    return { seq, type, payload };
  } catch {
    return null;
  }
}

function dispatch(event: RealtimeEvent): void {
  // 按 seq 去重：补发与正常推送可能重叠，只有比 lastSeq 大的才算新事件。
  if (event.seq <= lastSeq) return;

  lastSeq = event.seq;
  storeSeq(lastSeq);

  for (const listener of listeners) listener(event);
}

function openSocket(): void {
  if (socket && (status === "connecting" || status === "open")) return;

  const token = config.getToken();

  if (!token) {
    setStatus("closed");

    return;
  }

  manuallyClosed = false;
  setStatus("connecting");

  const ws = config.createSocket(config.url || defaultUrl());

  socket = ws;

  ws.onopen = () => {
    if (socket !== ws) return;

    attempts = 0;
    setStatus("open");
    // 认证帧带 sinceSeq：服务端据此补发断线期间的事件。
    ws.send(JSON.stringify({ type: "auth", token, sinceSeq: lastSeq }));
    startHeartbeat();
  };

  ws.onmessage = ({ data }) => {
    if (socket !== ws) return;

    const event = parseFrame(data);

    if (event) dispatch(event);
  };

  ws.onerror = () => {
    // 错误之后浏览器必然触发 close，重连统一在 onclose 里排。
  };

  ws.onclose = () => {
    if (socket !== ws) return;

    stopHeartbeat();
    socket = null;
    setStatus("closed");

    if (!manuallyClosed && listeners.size > 0) scheduleReconnect();
  };
}

/** 订阅事件；第一个订阅者触发建连。返回退订函数 —— 退订不断开连接。 */
export function subscribeRealtime(listener: RealtimeListener): () => void {
  listeners.add(listener);

  if (typeof window === "undefined") return () => listeners.delete(listener);

  lastSeq = Math.max(lastSeq, readStoredSeq());
  openSocket();

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

/** 登出时主动断开：不重连、清 lastSeq（下个账号从 0 开始）。 */
export function closeRealtime(): void {
  manuallyClosed = true;

  if (reconnectTimer !== null) clearTimeout(reconnectTimer);

  reconnectTimer = null;
  stopHeartbeat();
  socket?.close(1000, "logout");
  socket = null;
  lastSeq = 0;
  attempts = 0;
  storeSeq(0);
  setStatus("closed");
}

/** 测试用：重置模块状态（不碰 config）。 */
export function resetRealtimeForTests(): void {
  closeRealtime();
  listeners.clear();
  statusListeners.clear();
  status = "idle";
  manuallyClosed = false;
}

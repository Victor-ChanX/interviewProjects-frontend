// 登录态的唯一边界（frontend-api-function-calls「Storage Boundary」api.storage-boundary）：
// access token 存模块内存，sessionStorage 只做「刷新页面不掉」的备份（标签页关闭即失效，
// 与 15 分钟有效期的 access token 一致）。refresh token 只在 HttpOnly cookie（后端 #17），
// 前端 NEVER 读它。
//
// 展示用的身份 { username, role } 从 JWT payload 解出 —— 只解码不验签（签名由后端验，
// 前端拿它决定要不要渲染写操作按钮，真正的权限闸门在后端 403）。
//
// 消费方：请求层 src/lib/request.ts 取 token / 401 时清会话；src/hooks/use-session.ts 用
// subscribeSession + getSession 接成 useSyncExternalStore；登录 hook 写 token、退出清会话。

/** 用户角色：后端 src/core/jwt.ts 的 Role（不在 openapi 里 —— login 只返回 accessToken，故手写）。 */
export type Role = "admin" | "viewer";

export interface Principal {
  username: string;
  role: Role;
}

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  admin: "管理员",
  viewer: "只读",
};

/** 题目 2.3 / A0：viewer 对所有写操作得 403 —— 前端据此不渲染写操作按钮。 */
export function canWrite(role: Role): boolean {
  return role === "admin";
}

const ACCESS_TOKEN_KEY = "access_token";

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "viewer";
}

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    return decodeURIComponent(
      Array.from(
        atob(padded),
        (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
  } catch {
    return null;
  }
}

/**
 * 从 access token（HS256 JWT）的 payload 解出展示用身份。不验签；格式坏、缺 username / role、
 * 或 exp 已过（按 nowSeconds 判）都返回 null —— 过期 token 与没登录同样处理，省一次必然 401 的请求。
 */
export function decodeAccessToken(
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Principal | null {
  const segments = token.split(".");

  if (segments.length !== 3) return null;

  const json = decodeBase64Url(segments[1]);

  if (json === null) return null;

  let payload: unknown;

  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  const { username, role, exp } = payload as {
    username?: unknown;
    role?: unknown;
    exp?: unknown;
  };

  if (typeof username !== "string" || !username || !isRole(role)) return null;

  if (typeof exp === "number" && exp <= nowSeconds) return null;

  return { username, role };
}

// ---- 会话存储：内存为准，sessionStorage 备份 ----

let accessToken: string | null = null;
let principal: Principal | null = null;
const listeners = new Set<() => void>();

function readBackup(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeBackup(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // storage 不可用（隐私模式）时只丢「刷新不掉」这一项，内存里的会话照常。
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** 内存没有时从备份恢复一次（刷新页面后的首次读取）；备份里的 token 已过期就顺手清掉。 */
function restore(): void {
  if (accessToken !== null) return;

  const backup = readBackup();

  if (!backup) return;

  const decoded = decodeAccessToken(backup);

  if (!decoded) {
    writeBackup(null);

    return;
  }

  accessToken = backup;
  principal = decoded;
}

export function getAccessToken(): string | null {
  restore();

  return accessToken;
}

/** 展示用身份；未登录（或 token 过期 / 不可解）为 null。同一会话内返回同一引用（useSyncExternalStore 要求）。 */
export function getSession(): Principal | null {
  restore();

  return principal;
}

/** 登录成功后写入；解不出身份的 token 视为无效，等同清会话。 */
export function setAccessToken(token: string): void {
  const decoded = decodeAccessToken(token);

  accessToken = decoded ? token : null;
  principal = decoded;
  writeBackup(accessToken);
  notify();
}

/** 退出登录 / 401：清内存与备份。refresh cookie 由后端作废（#17），前端不碰。 */
export function clearSession(): void {
  const hadSession = accessToken !== null || readBackup() !== null;

  accessToken = null;
  principal = null;
  writeBackup(null);

  if (hadSession) notify();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

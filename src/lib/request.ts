// 请求层：base URL、鉴权头、JSON、401 处理、错误解析、重试只在这一处
// （frontend-api-function-calls「Request Layer」）。业务代码只用 @/lib/api 的 api.get/post。
//
// access token 的存取在 src/lib/auth.ts（内存 + sessionStorage 备份）：这里只取来放进
// Authorization。
//
// 401 与刷新（题目 B3 前端；#17，规则 frontend-api-function-calls「请求层：401 与刷新」
// req.refresh-single-flight）：带 Authorization 的请求得到 401 → 先 refreshAccessToken()
// （`POST /api/auth/refresh`，凭证是 HttpOnly cookie `refresh_token`，Path=/api/auth，请求带
// credentials，不带 Bearer；前端 NEVER 读它、存它）→ 成功则 setAccessToken 并把原请求**重放一次**；
// 重放仍 401 就当会话失效，不再刷（两个过期 token 会互相触发无限刷新）。
// 单飞：模块级 `refreshing` 存着进行中的刷新 Promise，并发的 401 只 await 同一个，refresh 只发一次；
// 刷新完成后才回来的 401（带旧 token 发出、响应慢）不再刷：比对发出时的 token 与当前 token，
// 已经换过就直接用新 token 重放（前端 #13），当前已无 token（上一次刷新失败清了会话）就照常抛 401。
// 刷新失败（refresh 也 401 / 网络错 / 响应里没有可解的 token）→ clearSession() + onAuthError()
// （受保护布局的容器注入「跳登录页带 next」，src/components/app-shell/use-app-shell.ts），
// 也只在那一次刷新里做一次。src/lib/ws.ts 收到 4401 时复用同一个 refreshAccessToken()。
// 自动重试（fetch 自身 reject：断线、超时）默认只给幂等方法（GET / PUT / DELETE）一次；POST / PATCH
// 默认不重试 —— 超时时服务端可能已经处理，静默再发一次就是群里两条相同消息（前端 #13）。
// 刷新页面时 access token 已过期 / 没有、但 refresh cookie 可能还有效：use-app-shell 在跳登录之前
// 先 refreshAccessToken({ silent: true }) 试一次 —— silent 只是不触发 onAuthError（守卫自己会
// 渲染 <Navigate> 去登录页，再触发一次就是双跳），会话照样清。
// refresh 的 fetch 写在这里而不是 services：请求层不能引 services（services → api → request 会成环），
// 而这个文件本来就是 eslint「不裸 fetch」的豁免块。

import { clearSession, getAccessToken, setAccessToken } from "@/lib/auth";

export { getAccessToken } from "@/lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class RequestError extends Error {
  readonly status: number;
  readonly detail: unknown;
  /**
   * 后端错误信封 `{ error: { code, message, requestId } }` 里的机器码
   * （ILLEGAL_TRANSITION / CAS_CONFLICT / ACCOUNT_UNAVAILABLE / GATEWAY_ERROR …）。
   * 业务层按它分支，不比对文案；信封里没有则为 null。
   */
  readonly code: string | null;

  constructor(
    status: number,
    message: string,
    detail?: unknown,
    code: string | null = null,
  ) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof RequestError && error.status === 401;
}

export type ResponseType = "auto" | "json" | "text" | "blob";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** false 时不带 Authorization（预签名直传等）。 */
  auth?: boolean;
  responseType?: ResponseType;
  timeout?: number;
  /**
   * 只覆盖网络错误（fetch 自身 reject，含超时）；HTTP 错误不重试。
   * 默认：幂等方法（GET / PUT / DELETE）1 次，POST / PATCH 0 次。
   */
  retries?: number;
  signal?: AbortSignal;
}

export interface RequestConfig {
  onAuthError: () => void;
}

const config: RequestConfig = {
  // 出厂空实现：受保护布局挂上后由 use-app-shell 注入「跳登录页带 next」。没注入时 401 也只是
  // 清会话 —— 守卫（app-shell-container）订阅着会话，读到 null 会自己渲染 <Navigate> 去登录页。
  onAuthError: () => {},
};

/** 没显式传 retries 时自动重试一次的方法：重发不会改变结果的那几个。 */
const IDEMPOTENT_METHODS: ReadonlySet<NonNullable<RequestOptions["method"]>> =
  new Set(["GET", "PUT", "DELETE"]);

export function configureRequest(next: Partial<RequestConfig>): void {
  Object.assign(config, next);
}

export function buildUrl(
  path: string,
  query?: RequestOptions["query"],
): string {
  const url = new URL(path, BASE_URL || window.location.origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;

    url.searchParams.set(key, String(value));
  }

  return BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

/** 源站挂了 / 超时 / 被 CDN 拦下时的状态码：提示「稍后再试」，而不是笼统的「请求失败」 */
const UNAVAILABLE_STATUS = /^(502|503|504|52\d)$/;

async function parseErrorMessage(
  response: Response,
): Promise<{ message: string; detail: unknown; code: string | null }> {
  const fallback = UNAVAILABLE_STATUS.test(String(response.status))
    ? `服务暂时不可用（HTTP ${response.status}），请稍后再试`
    : `请求失败（HTTP ${response.status}）`;

  try {
    const data: unknown = await response.json();

    // Cloudflare 自己生成的错误（前端 #22）：源站没响应或回了 502 时，它把响应体整个换成
    // { cloudflare_error: true, detail: "The origin web server…" }。英文 detail 不给用户看，用中文兜底。
    if (
      data &&
      typeof data === "object" &&
      (data as { cloudflare_error?: unknown }).cloudflare_error === true
    )
      return { message: fallback, detail: data, code: null };

    // 本仓后端的信封（题目 2.3）：{ error: { code, message, requestId, ...业务字段 } }。
    if (data && typeof data === "object" && "error" in data) {
      const envelope = (data as { error: unknown }).error;

      if (envelope && typeof envelope === "object") {
        const { code, message } = envelope as {
          code?: unknown;
          message?: unknown;
        };

        return {
          message: typeof message === "string" && message ? message : fallback,
          detail: envelope,
          code: typeof code === "string" ? code : null,
        };
      }
    }

    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;

      return {
        message: typeof detail === "string" ? detail : fallback,
        detail,
        code: null,
      };
    }

    return { message: fallback, detail: data, code: null };
  } catch {
    return { message: fallback, detail: undefined, code: null };
  }
}

async function parseBody<T>(
  response: Response,
  responseType: ResponseType,
): Promise<T> {
  if (response.status === 204) return undefined as T;

  if (responseType === "blob") return (await response.blob()) as T;

  if (responseType === "text") return (await response.text()) as T;

  if (responseType === "json") return (await response.json()) as T;

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json"))
    return (await response.json()) as T;

  return (await response.text()) as T;
}

// ---- 401 刷新（单飞）----

const REFRESH_URL = "/api/auth/refresh";

let refreshing: Promise<boolean> | null = null;
/** 本次单飞里是否有非 silent 的调用方：失败时只要有一个，就通知一次 onAuthError。 */
let notifyOnFail = false;

function failRefresh(): false {
  clearSession();

  return false;
}

/** 真正发一次 refresh；成功写入新 access token。所有失败都收敛成 false（并清会话；onAuthError 由单飞出口统一通知）。 */
async function fetchRefreshedToken(): Promise<boolean> {
  let response: Response;

  try {
    response = await fetch(buildUrl(REFRESH_URL), {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
  } catch {
    return failRefresh();
  }

  if (!response.ok) return failRefresh();

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    return failRefresh();
  }

  const accessToken =
    data && typeof data === "object" && "accessToken" in data
      ? (data as { accessToken: unknown }).accessToken
      : null;

  if (typeof accessToken !== "string" || !accessToken) return failRefresh();

  setAccessToken(accessToken);

  // setAccessToken 会把解不出身份 / 已过期的 token 当作无效丢掉：那也算刷新失败。
  return getAccessToken() !== null ? true : failRefresh();
}

export interface RefreshOptions {
  /**
   * true 时刷新失败不触发 onAuthError（会话照样清）。给「页面加载时无会话、先试一次续期」的守卫用：
   * 它自己会渲染 <Navigate> 去登录页，onAuthError 再 navigate 一次就是双跳。
   * 同一次单飞里只要有一个非 silent 的调用方（并发的 401），失败时仍通知一次。
   */
  silent?: boolean;
}

/**
 * 用 HttpOnly cookie 里的 refresh token 换新 access token。单飞：进行中时返回同一个 Promise，
 * 并发调用只发一次请求。resolve true = 新 token 已写入会话；false = 会话已清、onAuthError 已触发
 * （除非所有调用方都是 silent）。
 * 请求层 401 后、src/lib/ws.ts 的 4401、受保护布局的加载守卫（use-app-shell）都走这里；
 * 业务层 NEVER 直接调（req.no-refresh-in-feature）。
 */
export function refreshAccessToken(
  options: RefreshOptions = {},
): Promise<boolean> {
  if (!options.silent) notifyOnFail = true;

  if (refreshing === null) {
    refreshing = fetchRefreshedToken()
      .then((ok) => {
        if (!ok && notifyOnFail) config.onAuthError();

        return ok;
      })
      .finally(() => {
        refreshing = null;
        notifyOnFail = false;
      });
  }

  return refreshing;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number,
  timeout: number,
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const onAbort = () => controller.abort();

    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      // 只有 fetch 自身 reject（断网、超时）才重试；HTTP 错误在这个循环之外处理。
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;

      if (signal?.aborted) break;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError ?? new Error("网络错误");
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    headers = {},
    auth = true,
    responseType = "auto",
    timeout = 15_000,
    retries = IDEMPOTENT_METHODS.has(method) ? 1 : 0,
    signal,
  } = options;

  const url = buildUrl(path, query);
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  /** 最近一次发出时带的 access token：401 回来时拿它判断会话是否已经被别的请求续过期。 */
  let sentToken: string | null = null;

  const buildInit = (): RequestInit => {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...headers,
    };
    const token = auth ? getAccessToken() : null;

    sentToken = token;

    if (token) h.Authorization = `Bearer ${token}`;

    if (body !== undefined && !isFormData)
      h["Content-Type"] = "application/json";

    return {
      method,
      headers: h,
      credentials: "include",
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    };
  };

  let response = await fetchWithRetry(
    url,
    buildInit(),
    retries,
    timeout,
    signal,
  );

  // responseInterceptor 留在重试循环之外：HTTP 错误不重发，401 只走一次刷新。
  // 登录接口自己传 auth: false：账号密码错的 401 不算会话失效，也不去刷新。
  if (response.status === 401 && auth) {
    const current = getAccessToken();
    // 发出之后 token 已经换过：别的请求的刷新已经完成（成功 → 有新 token，直接重放；
    // 失败 → 会话已清、onAuthError 已通知，照常抛 401）。都不必再刷一轮。
    // 没换过才刷新 —— 单飞，并发的 401 共用同一个 Promise；成功后用新 token 重放一次
    // （buildInit 重新取 token），失败时刷新函数已清会话并通知 onAuthError，这里只把 401 照常抛出去。
    const renewed =
      current !== sentToken ? current !== null : await refreshAccessToken();

    if (renewed) {
      response = await fetchWithRetry(
        url,
        buildInit(),
        retries,
        timeout,
        signal,
      );

      // 重放仍 401：新 token 也不被认，当会话失效处理，不再刷新。
      if (response.status === 401) {
        clearSession();
        config.onAuthError();
      }
    }
  }

  if (!response.ok) {
    const { message, detail, code } = await parseErrorMessage(response);

    throw new RequestError(response.status, message, detail, code);
  }

  return parseBody<T>(response, responseType);
}

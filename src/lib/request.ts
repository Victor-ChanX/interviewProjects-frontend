// 请求层：base URL、鉴权头、JSON、401 处理、错误解析、重试只在这一处
// （frontend-api-function-calls「Request Layer」）。业务代码只用 @/lib/api 的 api.get/post。
//
// 401：清 access token 并交给 onAuthError；单飞 refresh 随后端 auth 一起落地（B3）。

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const ACCESS_TOKEN_KEY = "access_token";

export class RequestError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.detail = detail;
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
  /** 只覆盖网络错误（fetch 自身 reject）；HTTP 错误不重试。 */
  retries?: number;
  signal?: AbortSignal;
}

export interface RequestConfig {
  onAuthError: () => void;
}

const config: RequestConfig = {
  onAuthError: () => {},
};

export function configureRequest(next: Partial<RequestConfig>): void {
  Object.assign(config, next);
}

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // storage 不可用（隐私模式）时静默：请求会以未登录身份发出并走 401 流程。
  }
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

async function parseErrorMessage(
  response: Response,
): Promise<{ message: string; detail: unknown }> {
  const fallback = `请求失败（HTTP ${response.status}）`;

  try {
    const data: unknown = await response.json();

    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;

      return {
        message: typeof detail === "string" ? detail : fallback,
        detail,
      };
    }

    return { message: fallback, detail: data };
  } catch {
    return { message: fallback, detail: undefined };
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

// 401 刷新（单飞 refresh）随后端 `POST /api/auth/refresh` 一起落地（见 docs/plan.md B3）。

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
    retries = 1,
    signal,
  } = options;

  const url = buildUrl(path, query);
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const buildInit = (): RequestInit => {
    const h: Record<string, string> = {
      Accept: "application/json",
      ...headers,
    };
    const token = auth ? getAccessToken() : null;

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

  const response = await fetchWithRetry(
    url,
    buildInit(),
    retries,
    timeout,
    signal,
  );

  // responseInterceptor 留在重试循环之外：HTTP 错误不重发，401 只走一次刷新。
  if (response.status === 401 && auth) {
    setAccessToken(null);
    config.onAuthError();
  }

  if (!response.ok) {
    const { message, detail } = await parseErrorMessage(response);

    throw new RequestError(response.status, message, detail);
  }

  return parseBody<T>(response, responseType);
}

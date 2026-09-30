// api.get/post 封装：业务 service 只从这里发请求（frontend-api-function-calls「Request Layer」）。
// base URL、鉴权、401 刷新、错误解析、重试都在 @/lib/request 里，这里只是方法糖。

import { request, type RequestOptions } from "@/lib/request";

type MethodOptions = Omit<RequestOptions, "method" | "body">;

export const api = {
  request,
  get: <T>(path: string, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: MethodOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export { RequestError, isAuthError } from "@/lib/request";

// 登录 / 登出端点 wrapper（题目 2.3 `POST /api/auth/login`、B3 `POST /api/auth/logout`；前端 #2 / #17）：
// URL、方法、请求体在这里（api.wrapper-owns-url），类型从 api.generated 派生（api.types-derived）。
// 响应 { accessToken } 直接透传，不需要 normalize；写入会话由登录 hook 调 src/lib/auth.ts 完成。
// refresh（`POST /api/auth/refresh`）不在这里：它是请求层 401 处理的一部分，在 src/lib/request.ts
// 的 refreshAccessToken()（请求层不能引 services，否则 services → api → request 成环）。

import { api } from "@/lib/api";
import type { components, paths } from "@/types/api.generated";

export type LoginRequest =
  paths["/api/auth/login"]["post"]["requestBody"]["content"]["application/json"];

export type LoginResponse = components["schemas"]["LoginResponse"];

type LogoutResponse = components["schemas"]["LogoutResponse"];

const LOGIN_URL = "/api/auth/login";
const LOGOUT_URL = "/api/auth/logout";

/**
 * 账号密码登录。`auth: false`：不带 Authorization，也让请求层把「用户名或密码错误」的 401
 * 当普通错误抛出（RequestError，message 是错误信封的 error.message），而不是当会话失效清 token。
 * refresh token 随响应的 Set-Cookie 进 HttpOnly cookie（Path=/api/auth）：请求层所有请求都带
 * `credentials: "include"`，这里不用额外传。
 */
export function login(body: LoginRequest): Promise<LoginResponse> {
  return api.post<LoginResponse>(LOGIN_URL, body, { auth: false });
}

/**
 * 登出：后端把整个会话族作废并清 refresh cookie（凭 Bearer 找到会话，所以要在清本地会话之前调）。
 * 调用方（src/components/app-shell/use-app-shell.ts）失败也照样清本地会话 —— 后端不可达时不能把人困在页面里。
 */
export function logout(): Promise<LogoutResponse> {
  return api.post<LogoutResponse>(LOGOUT_URL);
}

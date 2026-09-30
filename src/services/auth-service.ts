// 登录端点 wrapper（题目 2.3 `POST /api/auth/login`；前端 #2）：URL、方法、请求体在这里
// （api.wrapper-owns-url），类型从 api.generated 派生（api.types-derived）。
// 响应 { accessToken } 直接透传，不需要 normalize；写入会话由登录 hook 调 src/lib/auth.ts 完成。
// refresh / logout（#17）以后加在这里。

import { api } from "@/lib/api";
import type { components, paths } from "@/types/api.generated";

export type LoginRequest =
  paths["/api/auth/login"]["post"]["requestBody"]["content"]["application/json"];

export type LoginResponse = components["schemas"]["LoginResponse"];

const LOGIN_URL = "/api/auth/login";

/**
 * 账号密码登录。`auth: false`：不带 Authorization，也让请求层把「用户名或密码错误」的 401
 * 当普通错误抛出（RequestError，message 是错误信封的 error.message），而不是当会话失效清 token。
 */
export function login(body: LoginRequest): Promise<LoginResponse> {
  return api.post<LoginResponse>(LOGIN_URL, body, { auth: false });
}

// 账号端点 wrapper（题目 2.3 accounts 三个端点；前端 #3）：URL、方法、请求体都在这里
// （api.wrapper-owns-url），类型从 api.generated 派生（api.types-derived）。
// GET /api/accounts 是裸数组（后端唯一不用 { items, total } 的列表端点），不需要 normalize。
// 失败抛 RequestError：status + code（ILLEGAL_TRANSITION / CAS_CONFLICT / ACCOUNT_UNAVAILABLE /
// GATEWAY_ERROR）由请求层从错误信封解析，业务层用 accountErrorCode(error) 分支。

import { api, RequestError } from "@/lib/api";
import type { components } from "@/types/api.generated";

export type AccountRead = components["schemas"]["AccountRead"];

export type AccountStatus = components["schemas"]["AccountStatus"];

export type AccountTransitionRequest = {
  to: components["schemas"]["AccountStatusInput"];
  expectedFrom: components["schemas"]["AccountStatusInput"];
};

export type AccountTransitionResponse =
  components["schemas"]["AccountTransitionResponse"];

/** 账号端点会返回、且 UI 要区分处理的错误码（后端 src/core/errors.ts 的 ErrorCode 子集）。 */
export const ACCOUNT_ERROR_CODES = [
  "ILLEGAL_TRANSITION",
  "CAS_CONFLICT",
  "ACCOUNT_UNAVAILABLE",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_EXISTS",
  "GATEWAY_ERROR",
] as const;

export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

const ACCOUNTS_URL = "/api/accounts";

function accountUrl(id: string, suffix: string): string {
  return `${ACCOUNTS_URL}/${encodeURIComponent(id)}/${suffix}`;
}

/** 新增一个服务账号（后端 #63，题目之外的控制台补充）：201 idle 账号；id 重复 409 ACCOUNT_EXISTS。 */
export function createAccount(id: string): Promise<AccountRead> {
  return api.post<AccountRead>(ACCOUNTS_URL, { id });
}

export function listAccounts(): Promise<AccountRead[]> {
  return api.get<AccountRead[]>(ACCOUNTS_URL);
}

/** 调网关 connect：idle / disconnected → online。 */
export function connectAccount(id: string): Promise<AccountRead> {
  return api.post<AccountRead>(accountUrl(id, "connect"));
}

/** 操作员手动标记状态；expectedFrom 做 CAS，当前状态已不是它 → 409 CAS_CONFLICT。 */
export function transitionAccount(
  id: string,
  body: AccountTransitionRequest,
): Promise<AccountTransitionResponse> {
  return api.post<AccountTransitionResponse>(
    accountUrl(id, "transition"),
    body,
  );
}

/** 从任意错误里取账号端点的机器码；不是 RequestError 或码不在清单里 → null。 */
export function accountErrorCode(error: unknown): AccountErrorCode | null {
  if (!(error instanceof RequestError) || error.code === null) return null;

  return (ACCOUNT_ERROR_CODES as readonly string[]).includes(error.code)
    ? (error.code as AccountErrorCode)
    : null;
}

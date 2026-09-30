// 登录态的 React 入口：把 src/lib/auth.ts 的会话存储接成 useSyncExternalStore。
// 登录（setAccessToken）/ 退出与 401（clearSession）都会让订阅者重渲染。
//
// 用法：
//   const session = useSession();            // null = 未登录（守卫据此跳登录页）
//   if (session?.canWrite) <Button>标记离线</Button>   // viewer 看不到写操作（题目第 4 节页面 1 / A0）
// 只要 canWrite 一个布尔值的地方写 `useSession()?.canWrite ?? false` 即可，不另开 hook。

import { useMemo, useSyncExternalStore } from "react";

import {
  canWrite,
  getSession,
  type Principal,
  subscribeSession,
} from "@/lib/auth";

export interface Session extends Principal {
  /** admin 为 true；viewer 为 false —— 决定要不要渲染写操作按钮，真正的闸门仍是后端 403。 */
  canWrite: boolean;
}

export function useSession(): Session | null {
  const principal = useSyncExternalStore(
    subscribeSession,
    getSession,
    getSession,
  );

  return useMemo(
    () =>
      principal ? { ...principal, canWrite: canWrite(principal.role) } : null,
    [principal],
  );
}

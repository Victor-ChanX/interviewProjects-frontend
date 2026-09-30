// 受保护区域的会话编排：登录态、401 → 登录页（注入请求层的 onAuthError）、退出、实时连接生命周期。
// 只在受保护布局（src/app/layout.tsx → app-shell-container）里用一次。

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { useRealtimeConnection, useRealtimeStatus } from "@/hooks/use-realtime";
import { useSession } from "@/hooks/use-session";
import { clearSession } from "@/lib/auth";
import { buildLoginRedirect, LOGIN_PATH } from "@/lib/login-redirect";
import { configureRequest } from "@/lib/request";
import { disconnectRealtime } from "@/lib/ws";
import { logout } from "@/services/auth-service";

export function useAppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const connection = useRealtimeStatus();

  // 未登录时守卫用：把当前页记进 next，登录完回来。
  const loginRedirect = buildLoginRedirect(
    `${location.pathname}${location.search}`,
  );

  // 401（请求层已 clearSession）：客户端路由跳登录页，next 取跳转那一刻的页面而不是闭包里的。
  useEffect(() => {
    configureRequest({
      onAuthError: () => {
        void navigate(
          buildLoginRedirect(
            `${window.location.pathname}${window.location.search}`,
          ),
          { replace: true },
        );
      },
    });

    return () => {
      configureRequest({ onAuthError: () => {} });
    };
  }, [navigate]);

  // 登录态就绪才建连；退出 / 401 清会话后断开（#4 的 useRealtimeConnection 自己读 useSession）。
  useRealtimeConnection();

  // 退出：先让后端作废整个会话族并清 refresh cookie（凭 Bearer 找会话，所以在清本地之前调；
  // 后端不可达 / 已失效也照样往下走，不能把人困在页面里），再断实时连接、清本地会话与缓存。
  const onLogout = useCallback(() => {
    void logout()
      .catch(() => {
        // 登出请求失败（断网、token 已失效）：本地照样清；服务端那份会话到期自然失效。
      })
      .finally(() => {
        disconnectRealtime();
        clearSession();
        // 缓存里是按角色可见的数据，不能留给下一位登录者。
        queryClient.clear();
        void navigate(LOGIN_PATH, { replace: true });
      });
  }, [navigate, queryClient]);

  return { session, connection, loginRedirect, onLogout };
}

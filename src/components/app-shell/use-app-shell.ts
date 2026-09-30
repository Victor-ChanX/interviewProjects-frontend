// 受保护区域的会话编排：登录态、加载时的静默续期（checking）、401 → 登录页（注入请求层的
// onAuthError）、退出、实时连接生命周期；以及布局要的路由派生（当前菜单项、面包屑、标签页标题）。
// 只在受保护布局（src/app/layout.tsx → app-shell-container）里用一次。

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useRealtimeConnection, useRealtimeStatus } from "@/hooks/use-realtime";
import { useSession } from "@/hooks/use-session";
import { clearSession } from "@/lib/auth";
import { buildLoginRedirect, LOGIN_PATH } from "@/lib/login-redirect";
import { buildBreadcrumbs, documentTitle, findNavItem } from "@/lib/nav";
import { configureRequest, refreshAccessToken } from "@/lib/request";
import { disconnectRealtime } from "@/lib/ws";
import { logout } from "@/services/auth-service";

export function useAppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const connection = useRealtimeStatus();

  // 加载守卫（题目 B3「access token 过期后自动续期」的刷新页面场景）：sessionStorage 里的备份
  // 过期时 src/lib/auth.ts 的 restore 会把它丢掉，守卫读到 null；但 HttpOnly 的 refresh cookie
  // 可能还有效 —— 跳登录之前先静默 refresh 一次，成功就直接渲染，不用重新输密码。
  // 策略是「每次挂载无会话就试一次」而不是看 sessionStorage 有没有登录痕迹：备份过期即被清、
  // 痕迹本身也要另存一个键才能留住，而 refresh 401 只是一次不带 Bearer 的便宜请求。
  // 只试一次：settled 后会话再变 null（401 / 退出）走原来的 <Navigate> / onAuthError，不再重试。
  const [bootstrap, setBootstrap] = useState<"pending" | "settled">(() =>
    session ? "settled" : "pending",
  );
  const checking = bootstrap === "pending" && session === null;

  useEffect(() => {
    if (bootstrap === "settled") return;

    let cancelled = false;

    // silent：失败时不触发 onAuthError（守卫自己会渲染 <Navigate> 去登录页，再 navigate 一次就是双跳）。
    // 单飞：StrictMode 双挂载 / 并发调用拿到的是同一个 Promise，只发一次请求。
    void refreshAccessToken({ silent: true }).finally(() => {
      if (!cancelled) setBootstrap("settled");
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  // 未登录时守卫用：把当前页记进 next，登录完回来。主动退出不带 next —— 下一位登录者不该落到上一位
  // 最后停留的页面。退出时 clearSession 让守卫先于 navigate 生效（登录页是懒加载路由，navigate 要等它），
  // 所以由这个标记决定守卫跳哪儿，而不是再补一次 navigate。
  const [loggingOut, setLoggingOut] = useState(false);
  const loginRedirect = loggingOut
    ? LOGIN_PATH
    : buildLoginRedirect(`${location.pathname}${location.search}`);

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

  // 菜单高亮与面包屑都按路由派生；浏览器标签页标题跟着当前页走。
  const { pathname } = location;
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const activeKey = findNavItem(pathname)?.item.key ?? null;

  useEffect(() => {
    document.title = documentTitle(pathname);
  }, [pathname]);

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
        // 与 clearSession 触发的重渲染同批：守卫渲染时已经是「主动退出」，跳不带 next 的登录页。
        setLoggingOut(true);
        clearSession();
        // 缓存里是按角色可见的数据，不能留给下一位登录者。
        queryClient.clear();
      });
  }, [queryClient]);

  return {
    session,
    checking,
    connection,
    loginRedirect,
    onLogout,
    breadcrumbs,
    activeKey,
  };
}

// 受保护区域的布局路由：登录守卫 + 壳（顶栏 / 导航）+ <Outlet />。只做路由级装配，不碰数据层。
// 守卫与壳的编排在 src/components/app-shell（container 读会话，未登录渲染 <Navigate to="/login?next=…" />）。

import { Outlet } from "react-router";

import { AppShellContainer } from "@/components/app-shell/app-shell-container";

export function Component() {
  return (
    <AppShellContainer>
      <Outlet />
    </AppShellContainer>
  );
}

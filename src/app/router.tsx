// 唯一的路由登记处：每条 { path, lazy: () => import("./<seg>/page") }。
// page.tsx / layout.tsx 按 React Router lazy 约定具名导出 Component；
// 结构地图（npm run map）从这里读路由路径，没登记的 page.tsx 会报 page-not-routed。
//
// 布局：/login 公开；其余全部挂在 "/" 的 layout（RequireAuth + 壳，src/components/app-shell）下，
// 未登录会被送到 /login?next=<当前页>。新页面在 children 里追加一条（目录名随意，路径以这里为准）。

import { createBrowserRouter, Navigate } from "react-router";

export const router = createBrowserRouter([
  { path: "/login", lazy: () => import("./login/page") },
  {
    path: "/",
    lazy: () => import("./layout"),
    children: [
      // 首页没有内容，直接落到账号列表（与 src/lib/login-redirect.ts 的 DEFAULT_AFTER_LOGIN 同口径）。
      { index: true, element: <Navigate to="/accounts" replace /> },
      // 前端 #3：账号列表
      { path: "accounts", lazy: () => import("./accounts/page") },
      // 前端 #4：群列表 + 群详情（含成员 / 消息时间线 / agent run 列表）
      { path: "groups", lazy: () => import("./groups/page") },
      {
        path: "groups/:groupId",
        lazy: () => import("./groups/[groupId]/page"),
      },
      // 前端 #6：序列运行（选序列 → 预检弹窗 → 启动；进度）
      {
        path: "groups/:groupId/sequences",
        lazy: () => import("./groups/[groupId]/sequences/page"),
      },
      // 前端 #5：agent run 详情（步骤表 + 协议错误步的原始响应）
      {
        path: "agent-runs/:runId",
        lazy: () => import("./agent-runs/[runId]/page"),
      },
      // 前端 #9：LLM 设置（Base URL / API Key / 模型；viewer 只读）
      { path: "settings/llm", lazy: () => import("./settings/llm/page") },
      { path: "*", lazy: () => import("./not-found") },
    ],
  },
]);

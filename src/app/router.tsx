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
      // 登录后默认进工作台（与 src/lib/login-redirect.ts 的 DEFAULT_AFTER_LOGIN 同口径）。
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // 前端 #12：工作台（概览 / 需要处理 / 实时动态）
      { path: "dashboard", lazy: () => import("./dashboard/page") },
      // 前端 #3：账号管理
      { path: "accounts", lazy: () => import("./accounts/page") },
      // 前端 #4：群组管理 + 群详情（消息 / 成员 / Agent 运行 / 序列）
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
      // 前端 #12：定时序列（序列定义列表 + 新建 + 在群启动）
      { path: "sequences", lazy: () => import("./sequences/page") },
      // 前端 #12：Agent 运行（全部群）；前端 #5：运行详情（步骤表 + 协议错误步的原始响应）
      { path: "agent-runs", lazy: () => import("./agent-runs/page") },
      {
        path: "agent-runs/:runId",
        lazy: () => import("./agent-runs/[runId]/page"),
      },
      // 前端 #12：实时动态、异常中心
      { path: "activity", lazy: () => import("./activity/page") },
      { path: "inconsistencies", lazy: () => import("./inconsistencies/page") },
      // 前端 #9：模型设置（Claude / Gemini 的 API Key 与模型；viewer 只读）
      { path: "settings/llm", lazy: () => import("./settings/llm/page") },
      { path: "*", lazy: () => import("./not-found") },
    ],
  },
]);

// 唯一的路由登记处：每条 { path, lazy: () => import("./<seg>/page") }。
// page.tsx / layout.tsx 按 React Router lazy 约定具名导出 Component；
// 结构地图（npm run map）从这里读路由路径，没登记的 page.tsx 会报 page-not-routed。

import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: () => import("./layout"),
    children: [
      { index: true, lazy: () => import("./example/page") },
      { path: "example", lazy: () => import("./example/page") },
      { path: "*", lazy: () => import("./not-found") },
    ],
  },
]);

// 布局路由：壳 + <Outlet />。只做路由级装配，不碰数据层。

import { Link, Outlet } from "react-router";

export function Component() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <Link to="/example" className="text-sm font-medium">
          Example
        </Link>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  );
}

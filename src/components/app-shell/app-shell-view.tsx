// view：顶栏（品牌 / 导航 / 用户名 / 角色徽标 / 退出）+ 页面区。纯展示，props 进回调出。

import { LogOut } from "lucide-react";
import { NavLink } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AppShellViewProps } from "./types";

const NAV_ITEMS = [
  { to: "/accounts", label: "账号" },
  { to: "/groups", label: "群组" },
] as const;

// 断线期间显示「重连中」（退避 / 重试中），带 sinceSeq 重连成功、服务端补发中显示「同步中」（#7）。
const CONNECTION_LABELS = {
  connecting: "连接中",
  reconnecting: "重连中",
  syncing: "同步中",
  open: "实时",
  closed: "离线",
} as const;

export function AppShellView({
  username,
  roleLabel,
  canWrite,
  connection,
  onLogout,
  children,
}: AppShellViewProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="text-sm font-semibold whitespace-nowrap">
            群组消息平台
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {connection !== "idle" ? (
              <Badge variant="outline">{CONNECTION_LABELS[connection]}</Badge>
            ) : null}
            <span className="text-sm">{username}</span>
            <Badge variant={canWrite ? "default" : "secondary"}>
              {roleLabel}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="size-4" />
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}

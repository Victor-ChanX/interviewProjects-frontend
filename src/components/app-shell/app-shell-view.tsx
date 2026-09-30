// view：后台布局骨架 —— 左侧菜单（可折叠为图标栏）+ 右侧工作台（顶栏 + 内容区）。纯展示，props 进回调出。

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebarView } from "./app-sidebar-view";
import { AppTopbarView } from "./app-topbar-view";
import type { AppShellViewProps } from "./types";

export function AppShellView({ sidebar, topbar, children }: AppShellViewProps) {
  return (
    <SidebarProvider>
      <AppSidebarView {...sidebar} />
      <SidebarInset className="min-w-0 bg-background">
        <AppTopbarView {...topbar} />
        <div className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

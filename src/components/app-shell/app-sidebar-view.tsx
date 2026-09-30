// view：左侧菜单。产品名 + 按「概览 / 运营 / 监控 / 系统」分组的叶子路由（当前路由高亮、异常中心带未处理数）
// + 底部当前用户（点开是角色说明与退出登录）。桌面可折叠为图标栏，窄屏是抽屉。
// 移动端点菜单项后收起抽屉：那是侧栏自己的视觉状态（useSidebar），不是业务状态。

import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_SECTIONS, type NavKey, PRODUCT_NAME } from "@/lib/nav";

import type { AppSidebarViewProps } from "./types";

const NAV_ICONS: Readonly<Record<NavKey, typeof Activity>> = {
  dashboard: LayoutDashboard,
  accounts: UserRound,
  groups: UsersRound,
  sequences: CalendarClock,
  agentRuns: Bot,
  activity: Activity,
  inconsistencies: AlertTriangle,
  llmSettings: SlidersHorizontal,
};

function initial(name: string): string {
  return name.slice(0, 1).toUpperCase() || "?";
}

export function AppSidebarView({
  activeKey,
  badges,
  user,
  onLogout,
}: AppSidebarViewProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-10"
              render={<Link to="/dashboard" onClick={closeOnMobile} />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <MessagesSquare className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">
                  {PRODUCT_NAME}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  多账号 · 可靠投递 · AI 群助手
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <Collapsible
            key={section.title}
            defaultOpen
            render={<SidebarGroup />}
            className="group/collapsible"
          >
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="cursor-pointer hover:text-sidebar-foreground"
            >
              {section.title}
              <ChevronDown className="ml-auto transition-transform group-data-[open]/collapsible:rotate-0 group-data-[closed]/collapsible:-rotate-90" />
            </SidebarGroupLabel>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.map((item) => {
                    const Icon = NAV_ICONS[item.key];
                    const badge = badges[item.key] ?? 0;

                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={item.key === activeKey}
                          tooltip={item.label}
                          className="data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary"
                          render={
                            <Link
                              to={item.path}
                              onClick={closeOnMobile}
                              data-testid={`nav-${item.key}`}
                            />
                          }
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {badge > 0 ? (
                          <SidebarMenuBadge className="rounded-full bg-destructive px-1.5 text-[11px] text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground">
                            {badge > 99 ? "99+" : badge}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent"
                render={<DropdownMenuTrigger data-testid="user-menu" />}
              >
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                    {initial(user.username)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user.username}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {user.roleLabel}
                  </span>
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
                className="w-64"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col gap-1 py-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <ShieldCheck className="size-4 text-primary" />
                      {user.username} · {user.roleLabel}
                    </span>
                    <span className="text-xs font-normal">
                      {user.roleDescription}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

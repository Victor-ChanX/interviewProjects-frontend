import type { ReactNode } from "react";

import type { ConnectionBadge } from "@/lib/connection-labels";
import type { Crumb, NavKey } from "@/lib/nav";

export interface AppUser {
  username: string;
  /** 角色徽标文案（src/lib/auth.ts 的 ROLE_LABELS）。 */
  roleLabel: string;
  /** 用户菜单里的角色说明。 */
  roleDescription: string;
  canWrite: boolean;
}

export interface AppSidebarViewProps {
  /** 当前路由属于哪个菜单项（详情页归到它的列表项）；null 不高亮。 */
  activeKey: NavKey | null;
  /** 菜单项上的数字徽标（异常中心的未处理数）；0 / 缺省不显示。 */
  badges: Partial<Record<NavKey, number>>;
  user: AppUser;
  onLogout: () => void;
}

export interface AppTopbarViewProps {
  breadcrumbs: readonly Crumb[];
  /** 实时连接徽标；未开始连接时为 null。 */
  connection: ConnectionBadge | null;
}

export interface AppShellViewProps {
  sidebar: AppSidebarViewProps;
  topbar: AppTopbarViewProps;
  /** 当前路由的页面（layout 里的 <Outlet />）。 */
  children: ReactNode;
}

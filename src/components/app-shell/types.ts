import type { ReactNode } from "react";

import type { ConnectionStatus } from "@/lib/ws";

export interface AppShellViewProps {
  username: string;
  /** 角色徽标文案（src/lib/auth.ts 的 ROLE_LABELS）。 */
  roleLabel: string;
  canWrite: boolean;
  connection: ConnectionStatus;
  onLogout: () => void;
  /** 当前路由的页面（layout 里的 <Outlet />）。 */
  children: ReactNode;
}

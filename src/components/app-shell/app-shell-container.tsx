// container：登录守卫（无会话 → 先静默续期一次（checking）→ 仍无会话 → /login?next=）+ 后台布局的编排；
// 视觉结构在 view。工作台概览的 WS 同步挂在这里一次（侧栏「异常中心」的未处理数与工作台共用那份缓存）。

import type { ReactNode } from "react";
import { Navigate } from "react-router";

import {
  useDashboardSummary,
  useDashboardSummarySync,
} from "@/hooks/use-dashboard-summary";
import { ROLE_LABELS } from "@/lib/auth";
import { connectionBadge } from "@/lib/connection-labels";

import { AppShellCheckingView } from "./app-shell-checking-view";
import { AppShellView } from "./app-shell-view";
import { useAppShell } from "./use-app-shell";

const ROLE_DESCRIPTIONS = {
  admin:
    "管理员：可以执行全部运营操作（连接账号、建群、发消息、改开关与模型设置）。",
  viewer: "只读：可以查看全部页面与实时数据，写操作按钮不会出现。",
} as const;

export function AppShellContainer({ children }: { children: ReactNode }) {
  const shell = useAppShell();
  const loggedIn = shell.session !== null;

  useDashboardSummarySync();

  const { summary } = useDashboardSummary({ enabled: loggedIn });

  if (shell.checking) return <AppShellCheckingView />;

  if (!shell.session) return <Navigate to={shell.loginRedirect} replace />;

  return (
    <AppShellView
      sidebar={{
        activeKey: shell.activeKey,
        badges: { inconsistencies: summary?.inconsistencies.unresolved ?? 0 },
        user: {
          username: shell.session.username,
          roleLabel: ROLE_LABELS[shell.session.role],
          roleDescription: ROLE_DESCRIPTIONS[shell.session.role],
          canWrite: shell.session.canWrite,
        },
        onLogout: shell.onLogout,
      }}
      topbar={{
        breadcrumbs: shell.breadcrumbs,
        connection: connectionBadge(shell.connection),
      }}
    >
      {children}
    </AppShellView>
  );
}

// container：登录守卫（无会话 → 先静默续期一次（checking）→ 仍无会话 → /login?next=）+ 壳的编排；
// 视觉结构在 view。

import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { ROLE_LABELS } from "@/lib/auth";

import { AppShellCheckingView } from "./app-shell-checking-view";
import { AppShellView } from "./app-shell-view";
import { useAppShell } from "./use-app-shell";

export function AppShellContainer({ children }: { children: ReactNode }) {
  const shell = useAppShell();

  if (shell.checking) return <AppShellCheckingView />;

  if (!shell.session) return <Navigate to={shell.loginRedirect} replace />;

  return (
    <AppShellView
      username={shell.session.username}
      roleLabel={ROLE_LABELS[shell.session.role]}
      canWrite={shell.session.canWrite}
      connection={shell.connection}
      onLogout={shell.onLogout}
    >
      {children}
    </AppShellView>
  );
}

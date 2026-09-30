// container：登录守卫（未登录 → /login?next=）+ 壳的编排；视觉结构在 view。

import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { ROLE_LABELS } from "@/lib/auth";

import { AppShellView } from "./app-shell-view";
import { useAppShell } from "./use-app-shell";

export function AppShellContainer({ children }: { children: ReactNode }) {
  const shell = useAppShell();

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

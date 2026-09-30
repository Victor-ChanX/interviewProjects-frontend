// container：工作台的编排 —— 概览、实时动态、快捷操作（admin 是写操作入口，viewer 换成查看入口）。

import { useSession } from "@/hooks/use-session";

import { DashboardView } from "./dashboard-view";
import type { QuickAction } from "./types";
import { useDashboard } from "./use-dashboard";

const ADMIN_ACTIONS: QuickAction[] = [
  { key: "createGroup", label: "新建群", href: "/groups?create=true" },
  { key: "accounts", label: "连接账号", href: "/accounts?status=offline" },
  { key: "llmSettings", label: "模型设置", href: "/settings/llm" },
];

const VIEWER_ACTIONS: QuickAction[] = [
  { key: "createGroup", label: "查看群组", href: "/groups" },
  { key: "accounts", label: "查看账号", href: "/accounts" },
  { key: "llmSettings", label: "模型设置", href: "/settings/llm" },
];

export function DashboardContainer() {
  const canWrite = useSession()?.canWrite ?? false;
  const state = useDashboard();
  const { activity } = state;

  return (
    <DashboardView
      today={state.today}
      updatedAt={state.updatedAt}
      loading={state.loading}
      error={state.error}
      retrying={state.retrying}
      onRefresh={state.refresh}
      cards={state.cards}
      attention={state.attention}
      quickActions={canWrite ? ADMIN_ACTIONS : VIEWER_ACTIONS}
      activity={{
        entries: activity.entries,
        now: state.now,
        loading: activity.loading,
        error: activity.error,
        retrying: activity.retrying,
        onRetry: state.refresh,
      }}
    />
  );
}

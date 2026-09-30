// 工作台：一眼看出平台是干什么的、现在怎么样。说明条 + 快捷操作 → 指标卡 → 「需要处理」+ 实时动态。纯展示。

import {
  ArrowRight,
  Bot,
  KeyRound,
  MessagesSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-atoms/page-header";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { DashboardActivityView } from "./dashboard-activity-view";
import { DashboardAttentionView } from "./dashboard-attention-view";
import { DashboardStatCardsView } from "./dashboard-stat-cards-view";
import type { DashboardViewProps, QuickAction } from "./types";

const QUICK_ICONS: Readonly<Record<QuickAction["key"], typeof Plus>> = {
  createGroup: Plus,
  accounts: UserRound,
  llmSettings: KeyRound,
};

const CAPABILITIES = [
  { icon: UserRound, text: "多账号托管与状态机" },
  { icon: ShieldCheck, text: "至少一次投递 + 去重" },
  { icon: MessagesSquare, text: "定时序列按步发言" },
  { icon: Bot, text: "AI 群助手自动应答" },
] as const;

export function DashboardView({
  today,
  timeZone,
  updatedAt,
  loading,
  error,
  retrying,
  onRefresh,
  cards,
  attention,
  quickActions,
  activity,
}: DashboardViewProps) {
  return (
    <>
      <PageHeader
        title="工作台"
        description={`今天是 ${today}（${timeZone}）· 数据每 30 秒自动刷新${updatedAt ? `，最近更新 ${updatedAt}` : ""}`}
        actions={
          <Button variant="outline" onClick={onRefresh} disabled={retrying}>
            <RefreshCw className={cn({ "animate-spin": retrying })} />
            刷新
          </Button>
        }
      />

      <section className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary/5 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-3">
            <p className="text-base leading-relaxed font-medium text-foreground">
              代管多个服务账号接入消息网关，把群消息记成可靠时间线，按定时序列发言，并由
              AI 群助手自动应答与管理成员。
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {CAPABILITIES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="size-4 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-nowrap">
            {quickActions.map((action, index) => {
              const Icon = QUICK_ICONS[action.key];

              return (
                <Button
                  key={action.key}
                  variant={index === 0 ? "default" : "outline"}
                  size="lg"
                  render={<Link to={action.href} />}
                  nativeButton={false}
                >
                  <Icon />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      {error && cards.length === 0 ? (
        <QueryError
          title="概览加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRefresh}
        />
      ) : (
        <DashboardStatCardsView cards={cards} loading={loading} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <DashboardAttentionView
          className="lg:col-span-2"
          items={attention}
          loading={loading}
        />
        <DashboardActivityView className="lg:col-span-3" {...activity} />
      </div>

      <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        想看全部动态？
        <Link
          to="/activity"
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          实时动态 <ArrowRight className="size-3" />
        </Link>
      </p>
    </>
  );
}

// 工作台概览端点 wrapper（后端 #22：`GET /api/dashboard/summary`；前端 #12）。URL 在这里（api.wrapper-owns-url），
// 类型从 api.generated 派生（api.types-derived）。工作台与侧栏「异常中心」的未处理数徽标共用这一份缓存。

import { api } from "@/lib/api";
import type { components } from "@/types/api.generated";

/** 账号 / 群 / 今日消息 / Agent 运行 / 序列 / job / 待处理异常的计数；「今日」按业务时区自然日（dayStart）。 */
export type DashboardSummary = components["schemas"]["DashboardSummary"];

const DASHBOARD_SUMMARY_URL = "/api/dashboard/summary";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>(DASHBOARD_SUMMARY_URL);
}

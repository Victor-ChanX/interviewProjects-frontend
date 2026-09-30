// 出站消息的投递状态 → 中文文案 / 徽标语气。群详情时间线与工作台共用。
// 文案与后端仓 docs/manual-testing.md 第 4、5 节一致（排队中 → 已受理 → 已发送；状态未知；发送失败；已取消）。

import type { StatusTone } from "@/lib/status-tone";
import type { components } from "@/types/api.generated";

type DeliveryStatus = components["schemas"]["DeliveryStatus"];

export const DELIVERY_STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> =
  {
    queued: "排队中",
    accepted: "已受理",
    sent: "已发送",
    failed: "发送失败",
    unknown: "状态未知",
    cancelled: "已取消",
  };

export const DELIVERY_STATUS_TONE: Readonly<
  Record<DeliveryStatus, StatusTone>
> = {
  queued: "neutral",
  accepted: "info",
  sent: "success",
  failed: "danger",
  unknown: "warning",
  cancelled: "muted",
};

/** 失败码要不要跟在状态后面显示：失败与取消都带原因（NETWORK_TIMEOUT / ACCOUNT_TERMINAL / GROUP_WRITE_FORBIDDEN）。 */
export function shouldShowFailCode(
  status: DeliveryStatus | null | undefined,
  failCode: string | null | undefined,
): boolean {
  return Boolean(failCode) && (status === "failed" || status === "cancelled");
}

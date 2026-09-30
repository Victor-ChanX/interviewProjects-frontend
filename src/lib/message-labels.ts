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

/** 平台用户 ID → 服务账号 ID（acc-1），由账号列表建；不在表里的是外部成员。 */
export function buildSenderNames(
  accounts: readonly { id: string; platformUserId: string | null }[],
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();

  for (const account of accounts)
    if (account.platformUserId) names.set(account.platformUserId, account.id);

  return names;
}

/** 时间线发送人：我方账号显示账号 ID（头像取「A」+ 编号），外部成员显示平台用户 ID。 */
export function senderDisplay(
  platformUserId: string,
  names: ReadonlyMap<string, string>,
): { name: string; initials: string } {
  const accountId = names.get(platformUserId);

  if (accountId) {
    const suffix = accountId.replace(/^acc-/, "");

    return {
      name: accountId,
      initials:
        suffix === accountId
          ? accountId.slice(0, 2).toUpperCase()
          : `A${suffix}`.slice(0, 3),
    };
  }

  return {
    name: platformUserId,
    initials: platformUserId
      .replace(/^(pu_|ext-|u-)/, "")
      .slice(0, 2)
      .toUpperCase(),
  };
}

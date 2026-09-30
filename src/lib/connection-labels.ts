// 实时连接状态 → 顶栏徽标（文案与后端仓 docs/manual-testing.md 第 8 节一致：重连中 → 同步中 → 实时）。
// idle = 还没开始连（未登录）：不显示徽标。

import type { StatusTone } from "@/lib/status-tone";
import type { ConnectionStatus } from "@/lib/ws";

export interface ConnectionBadge {
  label: string;
  tone: StatusTone;
  /** 是否在徽标上转圈 / 呼吸（进行中的状态）。 */
  pending: boolean;
}

const BADGES: Readonly<
  Record<Exclude<ConnectionStatus, "idle">, ConnectionBadge>
> = {
  connecting: { label: "连接中", tone: "info", pending: true },
  reconnecting: { label: "重连中", tone: "warning", pending: true },
  syncing: { label: "同步中", tone: "info", pending: true },
  open: { label: "实时", tone: "success", pending: false },
  closed: { label: "离线", tone: "muted", pending: false },
};

export function connectionBadge(
  status: ConnectionStatus,
): ConnectionBadge | null {
  return status === "idle" ? null : BADGES[status];
}

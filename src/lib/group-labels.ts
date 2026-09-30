// 群状态 / 成员角色 → 中文文案 / 徽标语气。群组管理、群详情、工作台、实时动态共用。
// 文案与后端仓 docs/manual-testing.md 一致：unreachable 是「不可写」（GROUP_WRITE_FORBIDDEN 之后），left 是「已退出」。

import type { StatusTone } from "@/lib/status-tone";
import type { components } from "@/types/api.generated";

type GroupStatus = components["schemas"]["GroupStatus"];

type MemberRole = components["schemas"]["MemberRole"];

export const GROUP_STATUS_LABELS: Readonly<Record<GroupStatus, string>> = {
  active: "正常",
  unreachable: "不可写",
  left: "已退出",
};

export const GROUP_STATUS_TONE: Readonly<Record<GroupStatus, StatusTone>> = {
  active: "success",
  unreachable: "danger",
  left: "muted",
};

export const MEMBER_ROLE_LABELS: Readonly<Record<MemberRole, string>> = {
  creator: "群主",
  admin: "管理员",
  member: "成员",
};

export const MEMBER_ROLE_TONE: Readonly<Record<MemberRole, StatusTone>> = {
  creator: "info",
  admin: "warning",
  member: "neutral",
};

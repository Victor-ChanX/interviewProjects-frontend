import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { JobProgressProps } from "@/components/ui-atoms/job-progress";
import type { AgentRunRead } from "@/services/agent-run-service";
import type { GroupMemberRead, GroupRead } from "@/services/group-service";
import type { MessageRead } from "@/services/message-service";

import type { GroupTab } from "./group-tabs";
import type { SendMessageFormValues } from "./send-message-schema";
import type { SimulateInboundFormValues } from "./simulate-inbound-schema";

/** 群的两个可切换开关（PATCH /api/groups/:id 的键）。 */
export type GroupSetting = "agentEnabled" | "autoKickEnabled";

export interface MemberTableViewProps {
  members: GroupMemberRead[];
}

/** 一条消息已取回的附件（题目 C1）：object URL；不是图片时 view 显示成链接。 */
export interface TimelineMedia {
  url: string;
  isImage: boolean;
}

export interface MessageTimelineViewProps {
  /** 全部已加载的消息，sentAt 倒序（最新在前）；渲染方向由 view 决定。 */
  messages: MessageRead[];
  /** msgId → 已取回的附件；mediaStatus = ready 但还没取回的不在里面（view 显示骨架）。 */
  media: ReadonlyMap<string, TimelineMedia>;
  /** 平台用户 ID → 服务账号 ID：我方账号发的消息显示成 acc-1 而不是 pu_xxx。 */
  senderNames: ReadonlyMap<string, string>;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}

/** 发消息表单可选的账号：本群成员里状态为 online 的服务账号。 */
export interface SendableAccount {
  accountId: string;
  platformUserId: string;
}

export interface SendMessageFormViewProps {
  accounts: SendableAccount[];
  /** 账号列表还没回来：下拉先禁用。 */
  accountsLoading: boolean;
  register: UseFormRegister<SendMessageFormValues>;
  errors: FieldErrors<SendMessageFormValues>;
  sending: boolean;
  /** 群不可写（unreachable / left）时整个表单禁用并给出原因；null 可写。 */
  disabledReason: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface AgentRunListViewProps {
  runs: AgentRunRead[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  /** 群当前进行中的 run（GroupRead.activeAgentRunId）；列表里对应行高亮。 */
  activeRunId: string | null;
  onRetry: () => void;
}

export interface LeaveAllDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 确认文案里的群名：网关群 ID（与页面标题一致），还没拿到时退回本地 ID。 */
  groupLabel: string;
  submitting: boolean;
  /** 提交被拒的整句提示（409 GROUP_ALREADY_LEFT / GROUP_NOT_READY / JOB_ALREADY_RUNNING 的 message）；null 不显示。 */
  submitError: string | null;
  onConfirm: () => void;
  /** 已拿到 jobId 时切到进度；null 表示还在确认。 */
  progress: (JobProgressProps & { running: boolean }) | null;
}

/** 「模拟外部发言」弹窗（前端 #19）：admin 且后端开关打开时才有。 */
export interface SimulateInboundDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: UseFormRegister<SimulateInboundFormValues>;
  errors: FieldErrors<SimulateInboundFormValues>;
  submitting: boolean;
  /** 本群开着 Agent 自动回复时提示「会触发一次运行」。 */
  agentEnabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** 已选的图片文件名；null = 没选（前端 #24） */
  imageName: string | null;
  /** 选的文件不合规的原因；null = 没问题 */
  imageError: string | null;
  /** file input 的 key：清掉选择时换一个，让不受控的 input 重建 */
  imageInputKey: number;
  onImageChange: (file: File | null) => void;
  onClearImage: () => void;
}

/** 删除已退出的群（前端 #25）：admin 才有。 */
export interface DeleteGroupDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupLabel: string;
  deleting: boolean;
  onConfirm: () => void;
}

export interface GroupDetailViewProps {
  group: GroupRead | undefined;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  tab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  /** admin 才显示开关与发消息表单（viewer 写操作 403）。 */
  canWrite: boolean;
  /** 正在保存的开关；null 表示空闲。 */
  savingSetting: GroupSetting | null;
  onToggleSetting: (setting: GroupSetting, value: boolean) => void;
  members: MemberTableViewProps;
  timeline: MessageTimelineViewProps;
  /** canWrite 为 false 时为 null，不渲染表单。 */
  sendForm: SendMessageFormViewProps | null;
  agentRuns: AgentRunListViewProps;
  /** admin 才有「全部退群」；viewer 为 null。按钮只在群 active / unreachable 时显示，弹窗一直挂着（进度要看完）。 */
  leaveAll: LeaveAllDialogViewProps | null;
  onLeaveAll: () => void;
  /** 演示用「模拟外部发言」：admin 且后端开关打开时才有；按钮只在群 active 时显示。 */
  simulateInbound: SimulateInboundDialogViewProps | null;
  onSimulateInbound: () => void;
  /** admin 才有「删除群」；按钮只在群已退出（left）时显示。 */
  deleteGroup: DeleteGroupDialogViewProps | null;
  onDeleteGroup: () => void;
}

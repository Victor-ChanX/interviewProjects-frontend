import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ConnectionStatus } from "@/lib/ws";
import type { AgentRunRead } from "@/services/agent-run-service";
import type { GroupMemberRead, GroupRead } from "@/services/group-service";
import type { MessageRead } from "@/services/message-service";

import type { SendMessageFormValues } from "./send-message-schema";

/** 群的两个可切换开关（PATCH /api/groups/:id 的键）。 */
export type GroupSetting = "agentEnabled" | "autoKickEnabled";

export interface MemberTableViewProps {
  members: GroupMemberRead[];
}

export interface MessageTimelineViewProps {
  /** 全部已加载的消息，sentAt 倒序（最新在前）；渲染方向由 view 决定。 */
  messages: MessageRead[];
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

export interface GroupDetailViewProps {
  group: GroupRead | undefined;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  connection: ConnectionStatus;
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
}

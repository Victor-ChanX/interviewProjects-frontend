import type { AgentRunStatus } from "@/services/agent-run-service";

export type AgentRunStatusFilter = "all" | AgentRunStatus;

export interface AgentRunRow {
  id: string;
  groupId: string;
  groupName: string;
  status: AgentRunStatus;
  endReasonLabel: string | null;
  summary: string | null;
  stepCount: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface AgentRunListViewProps {
  status: AgentRunStatusFilter;
  onStatusChange: (status: AgentRunStatusFilter) => void;
  /** 空串 = 全部群。 */
  group: string;
  onGroupChange: (groupId: string) => void;
  groupOptions: { value: string; label: string }[];
  rows: AgentRunRow[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (runId: string) => void;
}

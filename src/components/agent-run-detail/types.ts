import type {
  AgentRunDetail,
  AgentStepRead,
} from "@/services/agent-run-service";

export interface AgentStepTableViewProps {
  /** 按 index 升序，含协议错误步。 */
  steps: AgentStepRead[];
}

export interface AgentRunDetailViewProps {
  run: AgentRunDetail | undefined;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  /** run 被审计拦下（status = blocked）：顶部 destructive Alert。 */
  blocked: boolean;
  /** 所在群在界面上的名字（网关群 ID；群列表还没拉到时是缩写的 id）。 */
  groupName: string;
}

import type { ConnectionStatus } from "@/lib/ws";
import type {
  AgentRunDetail,
  AgentStepRead,
} from "@/services/agent-run-service";

export interface AgentStepTableViewProps {
  /** 按 index 升序，含协议错误步。 */
  steps: AgentStepRead[];
  /** 协议错误步的「查看原始响应」。 */
  onViewRawResponse: (step: AgentStepRead) => void;
}

export interface RawResponseDialogViewProps {
  open: boolean;
  /** 关闭后仍保留上一次的步（浮层淡出期间标题不能闪成空），所以 open 与 step 是两个 state。 */
  step: AgentStepRead | null;
  onOpenChange: (open: boolean) => void;
}

export interface AgentRunDetailViewProps {
  run: AgentRunDetail | undefined;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  connection: ConnectionStatus;
  /** run 被审计拦下（status = blocked）：顶部 destructive Alert。 */
  blocked: boolean;
  steps: AgentStepTableViewProps;
  rawDialog: RawResponseDialogViewProps;
}

// Agent run 端点 wrapper（题目 2.3 `GET /api/groups/:id/agent-runs`、`GET /api/agent-runs/:id`；
// 后端 #22 `GET /api/agent-runs?status=&groupId=&before=&limit=` 全部群的游标列表）。
// 列表最新在前、不含 steps；详情带全部步骤。类型从 api.generated 派生（api.types-derived）。

import { api } from "@/lib/api";
import { groupUrl } from "@/services/group-service";
import type { components } from "@/types/api.generated";

export type AgentRunRead = components["schemas"]["AgentRunRead"];

export type AgentRunDetail = components["schemas"]["AgentRunDetail"];

export type AgentRunListResponse =
  components["schemas"]["AgentRunListResponse"];

export type AgentRunStatus = components["schemas"]["AgentRunStatus"];

/** 全局列表的一行：比按群列表多带 gatewayGroupId（列表里显示群名用），少了预算 / 触发消息。 */
export type AgentRunListItem = components["schemas"]["AgentRunListItem"];

export type AgentRunPage = components["schemas"]["AgentRunPage"];

export interface ListAgentRunsParams {
  status?: AgentRunStatus;
  groupId?: string;
  before?: string;
  limit: number;
}

export type AgentRunEndReason = components["schemas"]["AgentRunEndReason"];

/** 详情里的一步（前端 #5）：协议错误步的 toolUseId / name / input 为 null，rawResponse 是截到 2KB 的原始响应体。 */
export type AgentStepRead = components["schemas"]["AgentStepRead"];

export type AgentStepKind = components["schemas"]["AgentStepKind"];

export type AuditVerdict = components["schemas"]["AuditVerdict"];

const AGENT_RUNS_URL = "/api/agent-runs";

// /api/groups 这个前缀的 owner 是 group-service（duplicate-endpoint-literal），这里只拼子路径。
export function groupAgentRunsUrl(groupId: string): string {
  return `${groupUrl(groupId)}/agent-runs`;
}

export function agentRunUrl(id: string): string {
  return `${AGENT_RUNS_URL}/${encodeURIComponent(id)}`;
}

/** 前端消费的列表负载：{ items, total } 直接透传（字段由快照派生）。 */
export function listGroupAgentRuns(
  groupId: string,
): Promise<AgentRunListResponse> {
  return api.get<AgentRunListResponse>(groupAgentRunsUrl(groupId));
}

/** 全部群的 agent run，按创建时间倒序游标分页；status / groupId 为空不带。 */
export function listAgentRuns(
  params: ListAgentRunsParams,
): Promise<AgentRunPage> {
  return api.get<AgentRunPage>(AGENT_RUNS_URL, {
    query: {
      status: params.status,
      groupId: params.groupId,
      before: params.before,
      limit: params.limit,
    },
  });
}

export function getAgentRun(id: string): Promise<AgentRunDetail> {
  return api.get<AgentRunDetail>(agentRunUrl(id));
}

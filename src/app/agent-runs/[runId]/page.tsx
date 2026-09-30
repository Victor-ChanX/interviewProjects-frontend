import { useParams } from "react-router";

import { AgentRunDetailContainer } from "@/components/agent-run-detail/agent-run-detail-container";

export function Component() {
  // 路由登记为 /agent-runs/:runId，参数一定存在；默认值只为收窄类型。
  const { runId = "" } = useParams();

  return <AgentRunDetailContainer runId={runId} />;
}

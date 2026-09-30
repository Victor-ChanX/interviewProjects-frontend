// container：hook 编排；渲染就绪的数据与回调通过 props 交给 view。实时订阅与轮询在 use-agent-run-detail 里。

import { useCallback } from "react";

import { AgentRunDetailView } from "./agent-run-detail-view";
import { useAgentRunDetail } from "./use-agent-run-detail";

export function AgentRunDetailContainer({ runId }: { runId: string }) {
  const detail = useAgentRunDetail(runId);
  const { refetch } = detail;

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <AgentRunDetailView
      run={detail.run}
      loading={detail.loading}
      error={detail.error}
      retrying={detail.retrying}
      onRetry={onRetry}
      blocked={detail.blocked}
      groupName={detail.groupName}
    />
  );
}

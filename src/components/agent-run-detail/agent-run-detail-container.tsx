// container：hook 编排 + 原始响应浮层的 open / target 两个 state；渲染就绪的数据与回调通过 props 交给 view。
// 实时订阅在 use-agent-run-detail 里；连接状态只是一个要显示的值。

import { useCallback, useState } from "react";

import { useRealtimeStatus } from "@/hooks/use-realtime";
import type { AgentStepRead } from "@/services/agent-run-service";

import { AgentRunDetailView } from "./agent-run-detail-view";
import { useAgentRunDetail } from "./use-agent-run-detail";

const NO_STEPS: AgentStepRead[] = [];

export function AgentRunDetailContainer({ runId }: { runId: string }) {
  const connection = useRealtimeStatus();
  const detail = useAgentRunDetail(runId);
  const { refetch } = detail;
  // 关只切 open，step 留到下次打开再覆盖：Base UI 的浮层关闭后节点还在淡出，清掉会让标题闪空。
  const [rawOpen, setRawOpen] = useState(false);
  const [rawStep, setRawStep] = useState<AgentStepRead | null>(null);

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onViewRawResponse = useCallback((step: AgentStepRead) => {
    setRawStep(step);
    setRawOpen(true);
  }, []);

  return (
    <AgentRunDetailView
      run={detail.run}
      loading={detail.loading}
      error={detail.error}
      retrying={detail.retrying}
      onRetry={onRetry}
      connection={connection}
      blocked={detail.blocked}
      steps={{ steps: detail.run?.steps ?? NO_STEPS, onViewRawResponse }}
      rawDialog={{ open: rawOpen, step: rawStep, onOpenChange: setRawOpen }}
    />
  );
}

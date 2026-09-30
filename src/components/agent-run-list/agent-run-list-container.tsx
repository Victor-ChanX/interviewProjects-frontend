// container：全局 Agent 运行列表的编排 —— 筛选（URL）、分页、行点击进详情；把行算成渲染就绪的形状交给 view。

import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";

import { AGENT_RUN_END_REASON_LABELS } from "@/lib/agent-run-labels";
import { shortId } from "@/lib/short-id";

import { AgentRunListView } from "./agent-run-list-view";
import type { AgentRunRow } from "./types";
import { useAgentRunList } from "./use-agent-run-list";

export function AgentRunListContainer() {
  const navigate = useNavigate();
  const list = useAgentRunList();
  const { runs, groupOptions, refetch, loadMore } = list;

  const rows = useMemo<AgentRunRow[]>(() => {
    const names = new Map(
      groupOptions.map((option) => [option.value, option.label]),
    );

    return runs.map((run) => ({
      id: run.id,
      groupId: run.groupId,
      groupName:
        run.gatewayGroupId ?? names.get(run.groupId) ?? shortId(run.groupId),
      status: run.status,
      endReasonLabel: run.endReason
        ? AGENT_RUN_END_REASON_LABELS[run.endReason]
        : null,
      summary: run.summary,
      stepCount: run.stepCount,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
    }));
  }, [groupOptions, runs]);

  const onOpen = useCallback(
    (runId: string) => {
      void navigate(`/agent-runs/${encodeURIComponent(runId)}`);
    },
    [navigate],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  return (
    <AgentRunListView
      status={list.status}
      onStatusChange={list.setStatus}
      group={list.group}
      onGroupChange={list.setGroup}
      groupOptions={groupOptions}
      rows={rows}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      onRetry={onRetry}
      hasMore={list.hasMore}
      loadingMore={list.loadingMore}
      onLoadMore={onLoadMore}
      onOpen={onOpen}
    />
  );
}

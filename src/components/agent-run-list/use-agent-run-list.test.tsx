// @vitest-environment jsdom
// 全局 Agent 运行列表：筛选来自 URL（工作台「需要处理」带 ?status=blocked 跳进来），「全部」不带参数；
// 群下拉的选项用网关群 ID；agent_run 事件按列表前缀重拉。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";

import { useAgentRunList } from "./use-agent-run-list";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());
const listAgentRuns = vi.hoisted(() => vi.fn());
const listGroups = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));
vi.mock("@/services/agent-run-service", () => ({ listAgentRuns }));
vi.mock("@/services/group-service", () => ({ listGroups }));

function setup(search: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const Nuqs = withNuqsTestingAdapter({
    searchParams: search,
    hasMemory: true,
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Nuqs, null, children),
    );

  return { invalidate, ...renderHook(() => useAgentRunList(), { wrapper }) };
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("useAgentRunList", () => {
  it("passes the URL filters to the service", async () => {
    listAgentRuns.mockResolvedValue({ items: [], nextCursor: null });
    listGroups.mockResolvedValue([
      { id: "g1", gatewayGroupId: "g_abc" },
      { id: "g2", gatewayGroupId: null },
    ]);

    const { result } = setup("?status=blocked&group=g1");

    await waitFor(() =>
      expect(listAgentRuns).toHaveBeenCalledWith({
        status: "blocked",
        groupId: "g1",
        before: undefined,
        limit: 30,
      }),
    );
    expect(result.current.status).toBe("blocked");
    await waitFor(() =>
      expect(result.current.groupOptions).toEqual([
        { value: "g1", label: "g_abc" },
        { value: "g2", label: "g2" },
      ]),
    );
  });

  it("drops the status parameter for 全部 and reloads on agent_run events", async () => {
    listAgentRuns.mockResolvedValue({ items: [], nextCursor: null });
    listGroups.mockResolvedValue([]);

    const { result, invalidate } = setup("?status=failed");

    await waitFor(() => expect(listAgentRuns).toHaveBeenCalledTimes(1));

    act(() => result.current.setStatus("all"));

    await waitFor(() =>
      expect(listAgentRuns).toHaveBeenLastCalledWith({
        status: undefined,
        groupId: undefined,
        before: undefined,
        limit: 30,
      }),
    );

    act(() => {
      for (const listener of listeners)
        listener({
          seq: 1,
          type: "agent_run",
          payload: { runId: "r1", groupId: "g1", status: "running" },
        });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.agentRuns.lists(),
    });
  });
});

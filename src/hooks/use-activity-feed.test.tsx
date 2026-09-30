// @vitest-environment jsdom
// 实时动态流：首屏走 service，WS 事件插到最前、按 seq 去重、工作台只留最新 N 条。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useActivityFeed } from "@/hooks/use-activity-feed";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";
import type { ActivityItem } from "@/services/activity-service";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());
const listActivity = vi.hoisted(() => vi.fn());
const listGroups = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));

vi.mock("@/services/activity-service", () => ({ listActivity }));
vi.mock("@/services/group-service", () => ({ listGroups }));

const GROUP_ID = "01a0f2e4-bd5c-771a-9fc1-cd66fef966de";

function item(seq: number): ActivityItem {
  return {
    seq,
    type: "message",
    payload: { groupId: GROUP_ID, isOwn: false },
    createdAt: "2026-09-30T08:00:00.000Z",
  };
}

function push(event: RealtimeEvent): void {
  for (const listener of listeners) listener(event);
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return createElement(QueryClientProvider, { client: queryClient }, children);
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("useActivityFeed", () => {
  it("loads the first page and names groups by gateway id", async () => {
    listActivity.mockResolvedValue({
      items: [item(2), item(1)],
      nextCursor: "c1",
    });
    listGroups.mockResolvedValue([{ id: GROUP_ID, gatewayGroupId: "g_abc" }]);

    const { result } = renderHook(() => useActivityFeed({ limit: 20 }), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.text)).toEqual([
        "群 g_abc 收到一条新消息",
        "群 g_abc 收到一条新消息",
      ]),
    );
    expect(listActivity).toHaveBeenCalledWith({ before: undefined, limit: 20 });
    expect(result.current.hasMore).toBe(true);
  });

  it("prepends pushed events once and caps the head page", async () => {
    listActivity.mockResolvedValue({
      items: [item(2), item(1)],
      nextCursor: null,
    });
    listGroups.mockResolvedValue([]);

    const { result } = renderHook(
      () => useActivityFeed({ limit: 20, maxHead: 2 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.entries).toHaveLength(2));

    const event: RealtimeEvent = {
      seq: 3,
      type: "agent_run",
      payload: { runId: "r1", groupId: GROUP_ID, status: "finished" },
    };

    act(() => push(event));
    act(() => push(event));
    act(() =>
      push({
        seq: 4,
        type: "inconsistency_resolved",
        payload: { id: "i1" },
      }),
    );

    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.key)).toEqual([
        "3",
        "2",
      ]),
    );
    expect(result.current.entries[0].href).toBe("/agent-runs/r1");
  });

  // 前端 #16：「加载更早」写回的是开始时的已加载页 + 更早一页，期间插到头部的事件不能被盖掉
  it("keeps an event pushed while 加载更早 is in flight", async () => {
    let releaseOlder: (page: unknown) => void = () => {};

    listActivity
      .mockResolvedValueOnce({ items: [item(3), item(2)], nextCursor: "c1" })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseOlder = resolve;
          }),
      );
    listGroups.mockResolvedValue([]);

    const { result } = renderHook(() => useActivityFeed({ limit: 20 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    act(() =>
      push({
        seq: 4,
        type: "agent_run",
        payload: { runId: "r1", groupId: GROUP_ID, status: "running" },
      }),
    );

    await act(async () => {
      releaseOlder({ items: [item(1)], nextCursor: null });
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.entries.map((entry) => entry.key)).toEqual([
      "4",
      "3",
      "2",
      "1",
    ]);
  });
});

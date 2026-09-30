// @vitest-environment jsdom
// 应用级「事件 → 缓存」同步（前端 #16）：页面卸载期间的事件也要让对应缓存过期，回到页面时重拉，
// 而不是在 staleTime 内直接显示旧缓存。

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  realtimeQueryTargets,
  useRealtimeQuerySync,
} from "@/hooks/use-realtime-query-sync";
import { queryKeys } from "@/lib/query-keys";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));

let seq = 0;

function push(type: string, payload: unknown): void {
  const event: RealtimeEvent = { seq: (seq += 1), type, payload };

  act(() => {
    for (const listener of listeners) listener(event);
  });
}

function setup() {
  const queryClient = new QueryClient({
    // 与 src/lib/query-client.ts 同口径：30 秒内回到页面不会自己重拉。
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  renderHook(() => useRealtimeQuerySync(), { wrapper });

  return { queryClient, wrapper };
}

function invalidated(queryClient: QueryClient, queryKey: readonly unknown[]) {
  return queryClient.getQueryState(queryKey)?.isInvalidated;
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

/** 动态流（工作台 / 实时动态页）：页面挂着时由 useActivityFeed 插头。 */
const ACTIVITY = { queryKey: queryKeys.activity.all, pageMerges: true };

describe("realtimeQueryTargets", () => {
  it("maps each event type to the query keys it changes", () => {
    const event = (type: string, payload: unknown): RealtimeEvent => ({
      seq: 1,
      type,
      payload,
    });

    expect(
      realtimeQueryTargets(
        event("message", { groupId: "g1", msgId: "m1", isOwn: false }),
      ),
    ).toEqual([
      { queryKey: queryKeys.messages.timeline("g1"), pageMerges: true },
      ACTIVITY,
    ]);
    expect(
      realtimeQueryTargets(
        event("agent_run", {
          runId: "r1",
          groupId: "g1",
          status: "blocked",
          endReason: "audit_blocked",
        }),
      ),
    ).toEqual([
      { queryKey: queryKeys.agentRuns.detail("r1") },
      { queryKey: queryKeys.agentRuns.byGroup("g1") },
      { queryKey: queryKeys.agentRuns.lists() },
      { queryKey: queryKeys.groups.all },
      ACTIVITY,
    ]);
    expect(
      realtimeQueryTargets(
        event("sequence_run", {
          runId: "s1",
          groupId: "g1",
          status: "running",
          currentStepIndex: 1,
        }),
      ),
    ).toEqual([
      { queryKey: queryKeys.sequenceRuns.detail("s1") },
      { queryKey: queryKeys.groups.detail("g1") },
      ACTIVITY,
    ]);
    expect(
      realtimeQueryTargets(
        event("job", { jobId: "j1", groupId: null, status: "running" }),
      ),
    ).toEqual([
      { queryKey: queryKeys.jobs.detail("j1") },
      { queryKey: queryKeys.groups.all },
      ACTIVITY,
    ]);

    for (const type of [
      "member_changed",
      "group_status_changed",
      "group_settings_changed",
    ])
      expect(realtimeQueryTargets(event(type, { groupId: "g1" }))).toEqual([
        { queryKey: queryKeys.groups.all },
        ACTIVITY,
      ]);

    expect(realtimeQueryTargets(event("inconsistency", { id: "i1" }))).toEqual([
      { queryKey: queryKeys.inconsistencies.lists() },
      ACTIVITY,
    ]);
    // 操作回执不进动态流。
    expect(
      realtimeQueryTargets(event("inconsistency_resolved", { id: "i1" })),
    ).toEqual([
      { queryKey: queryKeys.inconsistencies.lists() },
      { queryKey: queryKeys.inconsistencies.detail("i1") },
    ]);
    // 账号域由 useAccountEvents、概览由 useDashboardSummarySync 同步（同样挂在应用壳里）。
    expect(
      realtimeQueryTargets(
        event("account_status_changed", {
          accountId: "a1",
          from: "idle",
          to: "online",
        }),
      ),
    ).toEqual([ACTIVITY]);
    expect(realtimeQueryTargets(event("unknown", {}))).toEqual([]);
  });
});

describe("useRealtimeQuerySync", () => {
  // 前端 #16：在 run 详情页期间 run 变成 blocked，回到群详情仍显示 running、没有醒目提示
  it("expires caches of unmounted pages so returning within staleTime refetches them", async () => {
    const { queryClient, wrapper } = setup();
    const listRuns = vi
      .fn()
      .mockResolvedValue({ items: [{ id: "r1", status: "blocked" }] });

    queryClient.setQueryData(queryKeys.agentRuns.byGroup("g1"), {
      items: [{ id: "r1", status: "running" }],
    });
    queryClient.setQueryData(queryKeys.groups.detail("g1"), { id: "g1" });

    push("agent_run", {
      runId: "r1",
      groupId: "g1",
      status: "blocked",
      endReason: "audit_blocked",
    });

    expect(invalidated(queryClient, queryKeys.agentRuns.byGroup("g1"))).toBe(
      true,
    );
    expect(invalidated(queryClient, queryKeys.groups.detail("g1"))).toBe(true);
    // 没人看的缓存只标过期、不立刻重拉。
    expect(listRuns).not.toHaveBeenCalled();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: queryKeys.agentRuns.byGroup("g1"),
          queryFn: listRuns,
        }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({
        items: [{ id: "r1", status: "blocked" }],
      }),
    );
    expect(listRuns).toHaveBeenCalledTimes(1);
  });

  it("refetches mounted queries right away and leaves other groups alone", async () => {
    const { queryClient, wrapper } = setup();
    const getGroup = vi.fn().mockResolvedValue({ id: "g1", members: 2 });

    renderHook(
      () =>
        useQuery({
          queryKey: queryKeys.groups.detail("g1"),
          queryFn: getGroup,
        }),
      { wrapper },
    );
    await waitFor(() => expect(getGroup).toHaveBeenCalledTimes(1));
    queryClient.setQueryData(queryKeys.agentRuns.byGroup("g2"), { items: [] });

    push("member_changed", {
      groupId: "g1",
      platformUserId: "u1",
      accountId: null,
      change: "joined",
    });

    await waitFor(() => expect(getGroup).toHaveBeenCalledTimes(2));
    expect(invalidated(queryClient, queryKeys.agentRuns.byGroup("g2"))).toBe(
      false,
    );
  });

  it("leaves a mounted timeline to its page's in-place merge but expires an unmounted one", async () => {
    const { queryClient, wrapper } = setup();
    const listMessages = vi
      .fn()
      .mockResolvedValue({ pages: [{ items: [] }], pageParams: [undefined] });

    renderHook(
      () =>
        useQuery({
          queryKey: queryKeys.messages.timeline("g1"),
          queryFn: listMessages,
        }),
      { wrapper },
    );
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1));
    queryClient.setQueryData(queryKeys.messages.timeline("g2"), {
      pages: [{ items: [] }],
      pageParams: [undefined],
    });

    push("message", { groupId: "g1", msgId: "m1", isOwn: false });
    push("message", { groupId: "g2", msgId: "m2", isOwn: false });

    expect(invalidated(queryClient, queryKeys.messages.timeline("g1"))).toBe(
      false,
    );
    expect(invalidated(queryClient, queryKeys.messages.timeline("g2"))).toBe(
      true,
    );
    expect(listMessages).toHaveBeenCalledTimes(1);
  });

  it("expires an unmounted query whose request was in flight once it lands, since that response may predate the event", async () => {
    const { queryClient, wrapper } = setup();
    let release: (value: unknown) => void = () => {};

    const getRun = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce({ id: "r1", status: "blocked" });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.agentRuns.detail("r1"),
      queryFn: getRun,
    });

    push("agent_run", {
      runId: "r1",
      groupId: "g1",
      status: "blocked",
      endReason: "audit_blocked",
    });

    await act(async () => {
      release({ id: "r1", status: "running" });
    });

    expect(invalidated(queryClient, queryKeys.agentRuns.detail("r1"))).toBe(
      true,
    );
    // 没人看：只标过期，不白拉。
    expect(getRun).toHaveBeenCalledTimes(1);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: queryKeys.agentRuns.detail("r1"),
          queryFn: getRun,
        }),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.data).toEqual({ id: "r1", status: "blocked" }),
    );
  });
});

// @vitest-environment jsdom
// 工作台概览：轮询 + WS 同步。service 与实时连接都 mock，不发真实请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  adjustUnresolved,
  useDashboardSummary,
  useDashboardSummarySync,
} from "@/hooks/use-dashboard-summary";
import { queryKeys } from "@/lib/query-keys";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";
import type { DashboardSummary } from "@/services/dashboard-service";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());
const getDashboardSummary = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));

vi.mock("@/services/dashboard-service", () => ({ getDashboardSummary }));

function push(event: RealtimeEvent): void {
  for (const listener of listeners) listener(event);
}

const SUMMARY: DashboardSummary = {
  accounts: {
    idle: 0,
    online: 5,
    rate_limited: 0,
    disconnected: 0,
    suspended: 0,
    session_expired: 0,
    total: 5,
  },
  groups: { active: 2, unreachable: 0, left: 1, total: 3, agentEnabled: 1 },
  messages: {
    todayInbound: 3,
    todayOutbound: 2,
    outboundFailed: 0,
    outboundUnknown: 0,
    outboundQueued: 0,
  },
  agentRuns: { running: 0, todayFinished: 1, todayFailed: 0, blocked: 0 },
  sequenceRuns: { running: 0 },
  jobs: { running: 0, todayFailed: 0 },
  inconsistencies: { unresolved: 1 },
  dayStart: "2026-09-29T16:00:00.000Z",
  timeZone: "Asia/Shanghai",
  generatedAt: "2026-09-30T08:00:00.000Z",
};

/** 缓存按时区建：WS 同步要按前缀改到它（不管是哪个时区） */
const ZONE = "America/New_York";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, invalidate, wrapper };
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("adjustUnresolved", () => {
  it("adds and subtracts, never below zero, and does not invent a cache", () => {
    expect(adjustUnresolved(SUMMARY, 1)?.inconsistencies.unresolved).toBe(2);
    expect(adjustUnresolved(SUMMARY, -5)?.inconsistencies.unresolved).toBe(0);
    expect(adjustUnresolved(undefined, 1)).toBeUndefined();
  });
});

describe("useDashboardSummary", () => {
  it("loads the summary for the browser time zone and caches it under that zone", async () => {
    getDashboardSummary.mockResolvedValue(SUMMARY);

    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDashboardSummary(), { wrapper });
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    expect(result.current.loading).toBe(true);
    expect(result.current.timeZone).toBe(zone);
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(getDashboardSummary).toHaveBeenCalledWith(zone);
    expect(queryClient.getQueryData(queryKeys.dashboard.summary(zone))).toEqual(
      SUMMARY,
    );
  });
});

describe("useDashboardSummarySync", () => {
  it("bumps the unresolved count on inconsistency events and drops it on resolve", () => {
    const { queryClient, invalidate, wrapper } = setup();

    queryClient.setQueryData(queryKeys.dashboard.summary(ZONE), SUMMARY);
    renderHook(() => useDashboardSummarySync(), { wrapper });

    act(() =>
      push({
        seq: 1,
        type: "inconsistency",
        payload: { inconsistencyId: "i2", kind: "x", ref: null, message: "" },
      }),
    );
    expect(
      queryClient.getQueryData<DashboardSummary>(
        queryKeys.dashboard.summary(ZONE),
      )?.inconsistencies.unresolved,
    ).toBe(2);

    act(() =>
      push({
        seq: 2,
        type: "inconsistency_resolved",
        payload: { id: "i2", resolvedAt: "", resolvedBy: "admin" },
      }),
    );
    expect(
      queryClient.getQueryData<DashboardSummary>(
        queryKeys.dashboard.summary(ZONE),
      )?.inconsistencies.unresolved,
    ).toBe(1);
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey: queryKeys.dashboard.summary() },
      { cancelRefetch: false },
    );
  });

  it("invalidates (without touching counts) on other events", () => {
    const { queryClient, invalidate, wrapper } = setup();

    queryClient.setQueryData(queryKeys.dashboard.summary(ZONE), SUMMARY);
    renderHook(() => useDashboardSummarySync(), { wrapper });

    act(() =>
      push({
        seq: 3,
        type: "agent_run",
        payload: { runId: "r1", groupId: "g1", status: "blocked" },
      }),
    );

    expect(queryClient.getQueryData(queryKeys.dashboard.summary(ZONE))).toEqual(
      SUMMARY,
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyAccountStatus,
  useAccountEvents,
} from "@/hooks/use-account-events";
import { queryKeys } from "@/lib/query-keys";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";
import type { AccountRead } from "@/services/account-service";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));

function push(event: RealtimeEvent): void {
  for (const listener of listeners) listener(event);
}

const ACCOUNTS: AccountRead[] = [
  {
    id: "a-1",
    status: "rate_limited",
    platformUserId: "u-1",
    rateLimitedUntil: "2026-09-30T08:05:00.000Z",
  },
  {
    id: "a-2",
    status: "online",
    platformUserId: "u-2",
    rateLimitedUntil: null,
  },
];

function setup(seed: AccountRead[] | undefined) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (seed) queryClient.setQueryData(queryKeys.accounts.list(), seed);

  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  renderHook(() => useAccountEvents(), { wrapper });

  return { queryClient, invalidate };
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("applyAccountStatus", () => {
  it("patches only the matching row and clears rateLimitedUntil when leaving rate_limited", () => {
    expect(applyAccountStatus(ACCOUNTS, "a-1", "online")).toEqual([
      { ...ACCOUNTS[0], status: "online", rateLimitedUntil: null },
      ACCOUNTS[1],
    ]);
  });

  it("keeps rateLimitedUntil while still rate_limited and passes undefined through", () => {
    expect(applyAccountStatus(ACCOUNTS, "a-1", "rate_limited")).toEqual(
      ACCOUNTS,
    );
    expect(applyAccountStatus(undefined, "a-1", "online")).toBeUndefined();
  });
});

describe("useAccountEvents", () => {
  it("updates the cached row on account_status_changed and invalidates the domain", () => {
    const { queryClient, invalidate } = setup(ACCOUNTS);

    act(() => {
      push({
        seq: 1,
        type: "account_status_changed",
        payload: { accountId: "a-2", from: "online", to: "disconnected" },
      });
    });

    expect(
      queryClient.getQueryData<AccountRead[]>(queryKeys.accounts.list()),
    ).toEqual([ACCOUNTS[0], { ...ACCOUNTS[1], status: "disconnected" }]);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.accounts.all,
    });
  });

  it("marks the row terminal on account_terminal", () => {
    const { queryClient } = setup(ACCOUNTS);

    act(() => {
      push({
        seq: 2,
        type: "account_terminal",
        payload: { accountId: "a-1", status: "suspended" },
      });
    });

    expect(
      queryClient.getQueryData<AccountRead[]>(queryKeys.accounts.list())?.[0],
    ).toEqual({ ...ACCOUNTS[0], status: "suspended", rateLimitedUntil: null });
  });

  it("ignores other event types and does not create a list that was never fetched", () => {
    const { queryClient, invalidate } = setup(undefined);

    act(() => {
      push({ seq: 3, type: "message", payload: { groupId: "g" } });
      push({
        seq: 4,
        type: "account_status_changed",
        payload: { accountId: "a-9", from: "idle", to: "online" },
      });
    });

    expect(queryClient.getQueryData(queryKeys.accounts.list())).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

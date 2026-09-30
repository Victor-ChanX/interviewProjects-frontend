// @vitest-environment jsdom
// 异常中心：页签来自 URL、标记已处理后详情就地更新并重拉列表、别人标记的 WS 回执也写进详情。
// service 与实时连接都 mock，不发真实请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";
import type {
  InconsistencyDetail,
  InconsistencyRead,
} from "@/services/inconsistency-service";

import { useInconsistencies } from "./use-inconsistencies";

const listeners = vi.hoisted(() => new Set<(event: RealtimeEvent) => void>());
const service = vi.hoisted(() => ({
  listInconsistencies: vi.fn(),
  getInconsistency: vi.fn(),
  resolveInconsistency: vi.fn(),
}));

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },
}));
vi.mock("@/services/inconsistency-service", () => service);

const ROW: InconsistencyRead = {
  id: "i1",
  kind: "inbound_unknown_group",
  ref: "11",
  message: "message 事件指向本地没有的群 g_unknown",
  createdAt: "2026-09-30T08:00:00.000Z",
  resolvedAt: null,
  resolvedBy: null,
};

const DETAIL: InconsistencyDetail = { ...ROW, payload: { eventId: 11 } };

function setup(search = "") {
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

  return {
    queryClient,
    invalidate,
    ...renderHook(() => useInconsistencies(), { wrapper }),
  };
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("useInconsistencies", () => {
  it("lists the tab from the URL (default open) and switches to resolved", async () => {
    service.listInconsistencies.mockResolvedValue({
      items: [ROW],
      nextCursor: null,
    });

    const { result } = setup();

    await waitFor(() => expect(result.current.items).toEqual([ROW]));
    expect(result.current.tab).toBe("open");
    expect(service.listInconsistencies).toHaveBeenCalledWith({
      tab: "open",
      before: undefined,
      limit: 50,
    });

    act(() => result.current.changeTab("resolved"));

    await waitFor(() => expect(result.current.tab).toBe("resolved"));
    await waitFor(() =>
      expect(service.listInconsistencies).toHaveBeenLastCalledWith({
        tab: "resolved",
        before: undefined,
        limit: 50,
      }),
    );
  });

  it("opens the detail, resolves it and reloads the lists", async () => {
    service.listInconsistencies.mockResolvedValue({
      items: [ROW],
      nextCursor: null,
    });
    service.getInconsistency.mockResolvedValue(DETAIL);
    service.resolveInconsistency.mockResolvedValue({
      ...ROW,
      resolvedAt: "2026-09-30T09:00:00.000Z",
      resolvedBy: "admin",
    });

    const { result, invalidate } = setup();

    act(() => result.current.openDetail("i1"));

    await waitFor(() => expect(result.current.detail).toEqual(DETAIL));
    expect(result.current.detailOpen).toBe(true);

    await act(async () => {
      await result.current.resolve("i1");
    });

    expect(service.resolveInconsistency).toHaveBeenCalledWith("i1");
    await waitFor(() =>
      expect(result.current.detail?.resolvedBy).toBe("admin"),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.inconsistencies.lists(),
    });
  });

  it("writes someone else's resolve receipt into the cached detail", async () => {
    service.listInconsistencies.mockResolvedValue({
      items: [ROW],
      nextCursor: null,
    });
    service.getInconsistency.mockResolvedValue(DETAIL);

    const { result, queryClient } = setup("?tab=open");

    act(() => result.current.openDetail("i1"));
    await waitFor(() => expect(result.current.detail).toEqual(DETAIL));

    act(() => {
      for (const listener of listeners)
        listener({
          seq: 5,
          type: "inconsistency_resolved",
          payload: {
            id: "i1",
            resolvedAt: "2026-09-30T09:30:00.000Z",
            resolvedBy: "admin2",
          },
        });
    });

    expect(
      queryClient.getQueryData<InconsistencyDetail>(
        queryKeys.inconsistencies.detail("i1"),
      ),
    ).toMatchObject({
      resolvedAt: "2026-09-30T09:30:00.000Z",
      resolvedBy: "admin2",
    });
  });
});

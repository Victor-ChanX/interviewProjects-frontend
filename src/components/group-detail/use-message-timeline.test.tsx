// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEvent, RealtimeListener } from "@/lib/ws";
import type { MessagePage, MessageRead } from "@/services/message-service";

import { useMessageTimeline } from "./use-message-timeline";

const listeners = vi.hoisted(() => new Set<(event: unknown) => void>());
const listMessages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ws", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ws")>()),
  subscribeRealtime: (listener: RealtimeListener) => {
    listeners.add(listener as (event: unknown) => void);

    return () => {
      listeners.delete(listener as (event: unknown) => void);
    };
  },
}));
vi.mock("@/services/message-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/message-service")>()),
  listMessages,
}));

let seq = 0;

/** 假装 ws.ts 派发了一帧：同步调用所有订阅者。 */
function push(type: string, payload: unknown) {
  const event: RealtimeEvent = { seq: (seq += 1), type, payload };

  act(() => {
    for (const listener of listeners) listener(event);
  });
}

function msg(
  overrides: Partial<MessageRead> & { sentAt: string },
): MessageRead {
  return {
    msgId: null,
    clientMsgId: null,
    senderPlatformUserId: "u-other",
    isOwn: false,
    text: "t",
    deliveryStatus: null,
    failCode: null,
    ...overrides,
  };
}

const own = msg({
  clientMsgId: "c1",
  isOwn: true,
  senderPlatformUserId: "u-me",
  sentAt: "2026-09-30T10:03:00.000Z",
  deliveryStatus: "queued",
});
const m2 = msg({ msgId: "m2", sentAt: "2026-09-30T10:02:00.000Z" });
const m1 = msg({ msgId: "m1", sentAt: "2026-09-30T10:01:00.000Z" });
const FIRST_PAGE: MessagePage = { items: [own, m2], nextCursor: "cur1" };
const OLDER_PAGE: MessagePage = { items: [m1], nextCursor: null };

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => useMessageTimeline("g1"), { wrapper });
}

function keys(messages: MessageRead[]) {
  return messages.map((m) => m.clientMsgId ?? m.msgId);
}

afterEach(() => {
  listeners.clear();
  vi.clearAllMocks();
});

describe("useMessageTimeline", () => {
  it("loads the first page and appends the older page on loadMore", async () => {
    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      .mockResolvedValueOnce(OLDER_PAGE);

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(listMessages).toHaveBeenCalledWith("g1", {
      before: undefined,
      limit: 50,
    });
    expect(keys(result.current.messages)).toEqual(["c1", "m2"]);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["c1", "m2", "m1"]),
    );
    expect(listMessages).toHaveBeenLastCalledWith("g1", {
      before: "cur1",
      limit: 50,
    });
    expect(result.current.hasMore).toBe(false);
  });

  it("updates deliveryStatus in place for an own message event without refetching", async () => {
    listMessages.mockResolvedValueOnce(FIRST_PAGE);

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    push("message", {
      groupId: "g1",
      msgId: "m3",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
    });

    await waitFor(() =>
      expect(result.current.messages[0]).toEqual({
        ...own,
        msgId: "m3",
        deliveryStatus: "sent",
      }),
    );
    expect(listMessages).toHaveBeenCalledTimes(1);
  });

  it("refetches only the head page for a new message and merges it without duplicates", async () => {
    const m4 = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });

    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      .mockResolvedValueOnce(OLDER_PAGE)
      // 事件触发的最新页重拉：与缓存重叠的 c1 / m2 不重复，m4 插到头部。
      .mockResolvedValueOnce({ items: [m4, own, m2], nextCursor: "cur1" });

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages).toHaveLength(3));

    push("message", { groupId: "g1", msgId: "m4", isOwn: false });

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2", "m1"]),
    );
    expect(listMessages).toHaveBeenCalledTimes(3);
    expect(listMessages).toHaveBeenLastCalledWith("g1", { limit: 50 });
    // 旧页与游标没动。
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores events of other groups", async () => {
    listMessages.mockResolvedValueOnce(FIRST_PAGE);

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    push("message", { groupId: "g2", msgId: "m9", isOwn: false });
    push("agent_run", { groupId: "g1", runId: "r1", status: "running" });

    expect(listMessages).toHaveBeenCalledTimes(1);
    expect(keys(result.current.messages)).toEqual(["c1", "m2"]);
  });

  it("coalesces a burst of events into one in-flight refetch plus one catch-up", async () => {
    const m4 = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });
    const m5 = msg({ msgId: "m5", sentAt: "2026-09-30T10:05:00.000Z" });

    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      .mockResolvedValueOnce({ items: [m4, own, m2], nextCursor: "cur1" })
      .mockResolvedValueOnce({ items: [m5, m4, own, m2], nextCursor: "cur1" });

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    push("message", { groupId: "g1", msgId: "m4", isOwn: false });
    push("message", { groupId: "g1", msgId: "m5", isOwn: false });
    push("message", { groupId: "g1", msgId: "m5", isOwn: false });

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["m5", "m4", "c1", "m2"]),
    );
    // 首页 1 次 + 进行中 1 次 + 补拉 1 次；三条事件没有变成三次请求。
    expect(listMessages).toHaveBeenCalledTimes(3);
  });
});

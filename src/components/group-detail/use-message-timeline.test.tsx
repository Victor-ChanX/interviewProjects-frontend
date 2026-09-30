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
    mediaUrl: null,
    localFilePath: null,
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
  // 没被用掉的 mockResolvedValueOnce 不留给下一个用例
  listMessages.mockReset();
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

  // 前端 #14：断线期间新消息超过一页时，只拉最新一页会在中间留下永久空洞
  it("keeps paging older on catch-up until the fetched pages reach the cached messages", async () => {
    const newer = Array.from({ length: 6 }, (_, i) =>
      msg({ msgId: `n${9 - i}`, sentAt: `2026-09-30T10:0${9 - i}:30.000Z` }),
    );
    // 自己那条（c1）发出后 sentAt 变成网关时刻，排在断线期间的消息中间
    const ownSent = {
      ...own,
      msgId: "m3",
      deliveryStatus: "sent" as const,
      sentAt: "2026-09-30T10:05:00.000Z",
    };

    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      .mockResolvedValueOnce({ items: newer.slice(0, 2), nextCursor: "n1" })
      // 与缓存里的 c1 重叠还不算接上：它的位置变过，下面还有没拉到的
      .mockResolvedValueOnce({
        items: [...newer.slice(2, 4), ownSent],
        nextCursor: "n2",
      })
      .mockResolvedValueOnce({
        items: [...newer.slice(4), m2],
        nextCursor: "n3",
      });

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    push("message", { groupId: "g1", msgId: "n9", isOwn: false });

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual([
        "n9",
        "n8",
        "n7",
        "n6",
        "n5",
        "c1",
        "n4",
        "m2",
      ]),
    );
    expect(listMessages.mock.calls.slice(1)).toEqual([
      ["g1", { limit: 50 }],
      ["g1", { before: "n1", limit: 50 }],
      ["g1", { before: "n2", limit: 50 }],
    ]);
    // 「加载更早」仍接在原来的最后一页之后
    expect(result.current.hasMore).toBe(true);
  });

  // 前端 #14：首屏还在加载时到达的 message 事件不能丢 —— 首页请求可能早于这条消息落库
  it("refetches the head page when a message event arrives while it is loading", async () => {
    const m4 = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });
    let releaseFirst: (page: MessagePage) => void = () => {};

    listMessages
      .mockImplementationOnce(
        () =>
          new Promise<MessagePage>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: [m4, own, m2], nextCursor: "cur1" });

    const { result } = setup();

    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1));

    push("message", { groupId: "g1", msgId: "m4", isOwn: false });

    await act(async () => {
      releaseFirst(FIRST_PAGE);
    });

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2"]),
    );
    expect(listMessages).toHaveBeenCalledTimes(2);
    expect(listMessages).toHaveBeenLastCalledWith("g1", {
      before: undefined,
      limit: 50,
    });
  });

  // 前端 #16：TanStack v5 的 fetchNextPage 在开始时拿走已加载页的副本、结束时写回「副本 + 更早一页」，
  // 期间 setQueryData 并进来的新消息会被覆盖掉
  it("keeps a new message merged while 加载更早 is in flight", async () => {
    const m4 = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });
    let releaseOlder: (page: MessagePage) => void = () => {};

    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      .mockImplementationOnce(
        () =>
          new Promise<MessagePage>((resolve) => {
            releaseOlder = resolve;
          }),
      )
      .mockResolvedValueOnce({ items: [m4, own, m2], nextCursor: "cur1" });

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    push("message", { groupId: "g1", msgId: "m4", isOwn: false });

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2"]),
    );

    await act(async () => {
      releaseOlder(OLDER_PAGE);
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2", "m1"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps an own message's delivery status written while 加载更早 is in flight", async () => {
    let releaseOlder: (page: MessagePage) => void = () => {};

    listMessages.mockResolvedValueOnce(FIRST_PAGE).mockImplementationOnce(
      () =>
        new Promise<MessagePage>((resolve) => {
          releaseOlder = resolve;
        }),
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(true));

    push("message", {
      groupId: "g1",
      msgId: "m3",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
    });

    await act(async () => {
      releaseOlder(OLDER_PAGE);
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(keys(result.current.messages)).toEqual(["c1", "m2", "m1"]);
    expect(result.current.messages[0]).toEqual({
      ...own,
      msgId: "m3",
      deliveryStatus: "sent",
    });
    // 就地写，不发请求：首页 + 更早一页。
    expect(listMessages).toHaveBeenCalledTimes(2);
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

  it("is idempotent: the same message event replayed twice yields one row and no extra rows (#7 断线补发)", async () => {
    const m4 = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });
    const headWithM4: MessagePage = {
      items: [m4, own, m2],
      nextCursor: "cur1",
    };

    listMessages
      .mockResolvedValueOnce(FIRST_PAGE)
      // 重连补发：同一条事件到达两次 → 单飞 + 一次补拉，两次都拿到同一份最新页。
      .mockResolvedValueOnce(headWithM4)
      .mockResolvedValueOnce(headWithM4);

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    const replayed = { groupId: "g1", msgId: "m4", isOwn: false };

    push("message", replayed);
    push("message", replayed);

    await waitFor(() =>
      expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2"]),
    );
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(3));
    // 补拉完成后仍是同一份：没有第二行 m4。
    expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2"]);

    // 自己消息的投递事件重放两次：就地覆盖，结果一致，不再发请求。
    const delivered = {
      groupId: "g1",
      msgId: "m3",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
    };

    push("message", delivered);
    push("message", delivered);

    await waitFor(() =>
      expect(result.current.messages[1]).toEqual({
        ...own,
        msgId: "m3",
        deliveryStatus: "sent",
      }),
    );
    expect(keys(result.current.messages)).toEqual(["m4", "c1", "m2"]);
    expect(listMessages).toHaveBeenCalledTimes(3);
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

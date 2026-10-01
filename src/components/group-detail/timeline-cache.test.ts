import { describe, expect, it } from "vitest";

import {
  applyDeliveryUpdate,
  catchUpAnchor,
  flattenTimeline,
  isInLoadedHistory,
  mergeHeadPage,
  prependOwnMessage,
  reachesAnchor,
  type TimelineData,
} from "@/components/group-detail/timeline-cache";
import type { MessageRead } from "@/services/message-service";

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
    mediaStatus: null,
    ...overrides,
  };
}

// 两页：pages[0] 最新（10:03、10:02），pages[1] 更早（10:01）；c1 是自己发的 queued 消息。
const own = msg({
  clientMsgId: "c1",
  isOwn: true,
  senderPlatformUserId: "u-me",
  sentAt: "2026-09-30T10:03:00.000Z",
  deliveryStatus: "queued",
});
const m2 = msg({ msgId: "m2", sentAt: "2026-09-30T10:02:00.000Z" });
const m1 = msg({ msgId: "m1", sentAt: "2026-09-30T10:01:00.000Z" });
const data: TimelineData = {
  pages: [
    { items: [own, m2], nextCursor: "cur1" },
    { items: [m1], nextCursor: null },
  ],
  pageParams: [undefined, "cur1"],
};

describe("applyDeliveryUpdate", () => {
  it("rewrites status / failCode / msgId of the row with the same clientMsgId, on any page", () => {
    const next = applyDeliveryUpdate(data, {
      groupId: "g",
      msgId: "m9",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
    });

    expect(next).toEqual({
      pages: [
        {
          items: [{ ...own, msgId: "m9", deliveryStatus: "sent" }, m2],
          nextCursor: "cur1",
        },
        { items: [m1], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    });
  });

  it("keeps the old msgId when the event has none (cancelled before send)", () => {
    const next = applyDeliveryUpdate(data, {
      groupId: "g",
      msgId: null,
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "cancelled",
      failCode: "GROUP_UNREACHABLE",
    });

    expect(next?.pages[0]?.items[0]).toEqual({
      ...own,
      deliveryStatus: "cancelled",
      failCode: "GROUP_UNREACHABLE",
    });
  });

  // 前端 #17：排队的消息先按受理时刻 T0 排着，发出时刻 T1 更晚 —— 事件带了 sentAt 就按它挪位置
  it("moves the row to its new sentAt position when the event carries sentAt", () => {
    const next = applyDeliveryUpdate(data, {
      groupId: "g",
      msgId: "m9",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
      sentAt: "2026-09-30T10:01:30.000Z",
    });

    expect(flattenTimeline(next ?? undefined)).toEqual([
      m2,
      {
        ...own,
        msgId: "m9",
        deliveryStatus: "sent",
        sentAt: "2026-09-30T10:01:30.000Z",
      },
      m1,
    ]);
  });

  it("keeps the sentAt when the event has none", () => {
    const next = applyDeliveryUpdate(data, {
      groupId: "g",
      msgId: "m9",
      isOwn: true,
      clientMsgId: "c1",
      deliveryStatus: "sent",
      failCode: null,
    });

    expect(next?.pages[0]?.items[0]?.sentAt).toBe(own.sentAt);
  });

  it("returns null when the row is not cached or the event has no clientMsgId", () => {
    expect(
      applyDeliveryUpdate(data, {
        groupId: "g",
        msgId: "m5",
        isOwn: true,
        clientMsgId: "c-unknown",
        deliveryStatus: "sent",
      }),
    ).toBeNull();
    expect(
      applyDeliveryUpdate(data, { groupId: "g", msgId: "m5", isOwn: false }),
    ).toBeNull();
  });
});

describe("mergeHeadPage", () => {
  it("inserts unseen rows into pages[0] by sentAt desc and replaces seen rows in place, leaving old pages and cursors alone", () => {
    const newer = msg({ msgId: "m4", sentAt: "2026-09-30T10:04:00.000Z" });
    const between = msg({
      msgId: "m2b",
      sentAt: "2026-09-30T10:02:30.000Z",
    });
    const ownSent = { ...own, msgId: "m3", deliveryStatus: "sent" as const };

    const next = mergeHeadPage(data, [newer, ownSent, between, m2]);

    expect(next).toEqual({
      pages: [
        { items: [newer, ownSent, between, m2], nextCursor: "cur1" },
        { items: [m1], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    });
  });

  it("does not duplicate a row that already sits on an older page", () => {
    const next = mergeHeadPage(data, [own, m2, m1]);

    expect(flattenTimeline(next).map((m) => m.msgId ?? m.clientMsgId)).toEqual([
      "c1",
      "m2",
      "m1",
    ]);
  });

  // 前端 #17：自己的消息在受理时刻 T0 排队、T1 才发出（比别人的消息都晚）—— 合并时原位替换不重排，
  // 最新的一条显示在更早的消息下面。服务端顺序是 c1(10:01)、m2、m1。
  it("re-sorts the head by sentAt when an own message's sentAt moved later", () => {
    const ownQueued = { ...own, sentAt: "2026-09-30T10:00:00.000Z" };
    const early = msg({ msgId: "e1", sentAt: "2026-09-30T10:00:30.000Z" });
    const later = msg({ msgId: "e2", sentAt: "2026-09-30T10:00:45.000Z" });
    const ownSent = {
      ...own,
      msgId: "m9",
      deliveryStatus: "sent" as const,
      sentAt: "2026-09-30T10:01:00.000Z",
    };
    const cached: TimelineData = {
      pages: [{ items: [early, ownQueued], nextCursor: null }],
      pageParams: [undefined],
    };

    expect(
      flattenTimeline(mergeHeadPage(cached, [ownSent, later, early])),
    ).toEqual([ownSent, later, early]);
  });

  it("moves a row whose sentAt changed off an older page into the head", () => {
    // c1 当初按受理时刻被拉进更早的一页；最新页说它其实是最新的一条
    const ownQueued = { ...own, sentAt: "2026-09-30T10:00:00.000Z" };
    const cached: TimelineData = {
      pages: [
        { items: [m2], nextCursor: "cur1" },
        { items: [m1, ownQueued], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    };
    const ownSent = { ...own, msgId: "m9", deliveryStatus: "sent" as const };

    expect(mergeHeadPage(cached, [ownSent, m2])).toEqual({
      pages: [
        { items: [ownSent, m2], nextCursor: "cur1" },
        { items: [m1], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    });
  });

  it("keeps the backend order among rows with the same sentAt", () => {
    const a = msg({ msgId: "a", sentAt: m2.sentAt });
    const b = msg({ msgId: "b", sentAt: m2.sentAt });
    const next = mergeHeadPage(data, [own, b, a, m2]);

    expect(next.pages[0]?.items.map((m) => m.clientMsgId ?? m.msgId)).toEqual([
      "c1",
      "b",
      "a",
      "m2",
    ]);
  });

  // 前端 #17：补拉请求发出时 c1 还是 accepted，回来前 sent 事件已经就地写过 —— 旧快照不能把状态退回去
  it("does not let an older queued / accepted snapshot overwrite a settled delivery status", () => {
    const ownSent = {
      ...own,
      msgId: "m9",
      deliveryStatus: "sent" as const,
      sentAt: "2026-09-30T10:04:00.000Z",
    };
    const cached: TimelineData = {
      pages: [{ items: [ownSent, m2], nextCursor: null }],
      pageParams: [undefined],
    };
    const stale = { ...own, deliveryStatus: "accepted" as const };
    const m3 = msg({ msgId: "m3", sentAt: "2026-09-30T10:03:30.000Z" });

    expect(mergeHeadPage(cached, [stale, m3, m2]).pages[0]?.items).toEqual([
      ownSent,
      m3,
      m2,
    ]);

    // 反过来照常更新：unknown 可以回到 queued，cancelled 之后仍可能落地成 sent
    const cancelled = { ...own, deliveryStatus: "cancelled" as const };
    const withCancelled: TimelineData = {
      pages: [{ items: [cancelled, m2], nextCursor: null }],
      pageParams: [undefined],
    };

    expect(
      mergeHeadPage(withCancelled, [ownSent, m2]).pages[0]?.items[0],
    ).toEqual(ownSent);
  });

  it("returns the data unchanged in shape when fresh is empty", () => {
    expect(mergeHeadPage(data, [])).toEqual(data);
  });
});

describe("prependOwnMessage", () => {
  it("inserts a new own message at the head and skips a key already present", () => {
    const optimistic = msg({
      clientMsgId: "c2",
      isOwn: true,
      sentAt: "2026-09-30T10:05:00.000Z",
      deliveryStatus: "queued",
    });

    expect(prependOwnMessage(data, optimistic).pages[0]?.items).toEqual([
      optimistic,
      own,
      m2,
    ]);
    expect(prependOwnMessage(data, own)).toBe(data);
  });
});

describe("flattenTimeline", () => {
  it("concatenates pages in order and tolerates undefined", () => {
    expect(flattenTimeline(data)).toEqual([own, m2, m1]);
    expect(flattenTimeline(undefined)).toEqual([]);
  });

  // 前端 #14：自己消息的 sentAt 从受理时刻变成网关时刻后，同一条可能同时在两页里（渲染两行、React key 重复）
  it("keeps one row per messageKey across pages, the one on the newer page", () => {
    const ownAccepted = { ...own, sentAt: "2026-09-30T10:00:30.000Z" };
    const ownSent = {
      ...own,
      msgId: "m3",
      deliveryStatus: "sent" as const,
      sentAt: "2026-09-30T10:03:00.000Z",
    };
    const twice: TimelineData = {
      pages: [
        { items: [ownSent, m2], nextCursor: "cur1" },
        { items: [m1, ownAccepted], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    };

    expect(flattenTimeline(twice)).toEqual([ownSent, m2, m1]);
  });

  // 前端 #17：行留在旧页、sentAt 却变新了，拍平结果仍按 sentAt 倒序
  it("orders the flattened rows by sentAt desc across pages", () => {
    const ownSent = { ...own, sentAt: "2026-09-30T10:05:00.000Z" };
    const stale: TimelineData = {
      pages: [
        { items: [m2], nextCursor: "cur1" },
        { items: [ownSent, m1], nextCursor: null },
      ],
      pageParams: [undefined, "cur1"],
    };

    expect(flattenTimeline(stale)).toEqual([ownSent, m2, m1]);
  });
});

describe("catchUpAnchor / reachesAnchor", () => {
  it("anchors on the newest cached row that has no clientMsgId", () => {
    // own（c1）可能是乐观插入的受理时刻，位置不可信，不当接上点
    expect(catchUpAnchor(data)).toEqual({ key: "m2", sentAt: m2.sentAt });
  });

  it("falls back to the oldest cached row (time only) when every row carries a clientMsgId", () => {
    const own2 = msg({
      clientMsgId: "c2",
      isOwn: true,
      sentAt: "2026-09-30T10:04:00.000Z",
    });
    const onlyOwn: TimelineData = {
      pages: [{ items: [own2, own], nextCursor: null }],
      pageParams: [undefined],
    };

    expect(catchUpAnchor(onlyOwn)).toEqual({ key: null, sentAt: own.sentAt });
  });

  it("has no anchor for an empty timeline", () => {
    expect(
      catchUpAnchor({
        pages: [{ items: [], nextCursor: null }],
        pageParams: [undefined],
      }),
    ).toBeNull();
  });

  it("is reached by the anchor row itself or by any row older than it", () => {
    const anchor = { key: "m2", sentAt: m2.sentAt };
    const m9 = msg({ msgId: "m9", sentAt: "2026-09-30T10:09:00.000Z" });
    const ownLater = { ...own, sentAt: "2026-09-30T10:08:00.000Z" };

    // 只和缓存里的自己消息（c1）重叠不算接上：它的位置可能变过
    expect(reachesAnchor([m9, ownLater], anchor)).toBe(false);
    expect(reachesAnchor([m9, m2], anchor)).toBe(true);
    expect(reachesAnchor([m9, m1], anchor)).toBe(true);
    expect(reachesAnchor([], anchor)).toBe(false);
    // 没有 key 的兜底锚点只按时间判断
    expect(reachesAnchor([m2], { key: null, sentAt: m2.sentAt })).toBe(false);
    expect(reachesAnchor([m1], { key: null, sentAt: m2.sentAt })).toBe(true);
  });
});

describe("isInLoadedHistory", () => {
  // data 的接上点是 m2（10:02，最新的「位置可信」行）；最旧已加载 m1（10:01），最后一页已翻到头
  it("is true for a message older than the catch-up anchor but within the loaded range", () => {
    expect(isInLoadedHistory(data, "2026-09-30T10:01:30.000Z")).toBe(true);
  });

  it("is false at or after the anchor: the head-page refresh reaches it", () => {
    expect(isInLoadedHistory(data, "2026-09-30T10:02:00.000Z")).toBe(false);
    expect(isInLoadedHistory(data, "2026-09-30T10:05:00.000Z")).toBe(false);
  });

  it("covers anything older once the whole history is loaded, nothing older while more pages remain", () => {
    expect(isInLoadedHistory(data, "2026-09-30T09:00:00.000Z")).toBe(true);

    const partial: TimelineData = {
      pages: [
        { items: [own, m2], nextCursor: "cur1" },
        { items: [m1], nextCursor: "cur2" },
      ],
      pageParams: [undefined, "cur1"],
    };

    expect(isInLoadedHistory(partial, "2026-09-30T09:00:00.000Z")).toBe(false);
    expect(isInLoadedHistory(partial, "2026-09-30T10:01:00.000Z")).toBe(true);
  });

  it("is false for an empty cache (no anchor)", () => {
    expect(
      isInLoadedHistory(
        { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] },
        "2026-09-30T10:00:00.000Z",
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  applyDeliveryUpdate,
  flattenTimeline,
  mergeHeadPage,
  prependOwnMessage,
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
});

import { describe, expect, it } from "vitest";

import {
  eventToActivity,
  flattenActivity,
  prependActivity,
  type ActivityData,
} from "@/lib/activity-cache";
import type { ActivityItem } from "@/services/activity-service";

const AT = "2026-09-30T08:00:00.000Z";

function activity(seq: number): ActivityItem {
  return {
    seq,
    type: "message",
    payload: { groupId: "g1", isOwn: false },
    createdAt: AT,
  };
}

function data(...pages: number[][]): ActivityData {
  return {
    pages: pages.map((seqs, i) => ({
      items: seqs.map(activity),
      nextCursor: i < pages.length - 1 ? `c${i}` : null,
    })),
    pageParams: pages.map((_, i) => (i === 0 ? undefined : `c${i - 1}`)),
  };
}

describe("eventToActivity", () => {
  it("turns an activity-type frame into an item stamped with the receive time", () => {
    expect(
      eventToActivity(
        { seq: 9, type: "agent_run", payload: { runId: "r1" } },
        AT,
      ),
    ).toEqual({
      seq: 9,
      type: "agent_run",
      payload: { runId: "r1" },
      createdAt: AT,
    });
  });

  it("drops operation receipts and malformed payloads", () => {
    expect(
      eventToActivity(
        { seq: 1, type: "inconsistency_resolved", payload: { id: "i1" } },
        AT,
      ),
    ).toBeNull();
    expect(
      eventToActivity({ seq: 2, type: "message", payload: null }, AT),
    ).toBeNull();
    expect(
      eventToActivity({ seq: 3, type: "message", payload: [1] }, AT),
    ).toBeNull();
    expect(
      eventToActivity({ seq: 4, type: "brand_new", payload: {} }, AT),
    ).toBeNull();
  });
});

describe("prependActivity", () => {
  it("inserts into the head page by seq, leaving older pages and cursors alone", () => {
    const before = data([10, 8], [5, 4]);
    const next = prependActivity(before, activity(12));

    expect(next.pages[0].items.map((item) => item.seq)).toEqual([12, 10, 8]);
    expect(next.pages[1]).toBe(before.pages[1]);
    expect(next.pageParams).toBe(before.pageParams);
    expect(next.pages[0].nextCursor).toBe("c0");
  });

  it("places an out-of-order replay by seq", () => {
    expect(
      prependActivity(data([10, 8]), activity(9)).pages[0].items.map(
        (item) => item.seq,
      ),
    ).toEqual([10, 9, 8]);
    expect(
      prependActivity(data([10, 8]), activity(7)).pages[0].items.map(
        (item) => item.seq,
      ),
    ).toEqual([10, 8, 7]);
  });

  it("dedupes by seq across every page", () => {
    const before = data([10, 8], [5, 4]);

    expect(prependActivity(before, activity(8))).toBe(before);
    expect(prependActivity(before, activity(4))).toBe(before);
  });

  it("caps the head page when maxHead is given", () => {
    expect(
      prependActivity(data([3, 2, 1]), activity(4), 3).pages[0].items.map(
        (item) => item.seq,
      ),
    ).toEqual([4, 3, 2]);
  });

  it("does nothing without a loaded page", () => {
    const empty: ActivityData = { pages: [], pageParams: [] };

    expect(prependActivity(empty, activity(1))).toBe(empty);
  });
});

describe("flattenActivity", () => {
  it("concatenates pages newest first", () => {
    expect(flattenActivity(data([3, 2], [1]))).toHaveLength(3);
    expect(flattenActivity(undefined)).toEqual([]);
  });
});

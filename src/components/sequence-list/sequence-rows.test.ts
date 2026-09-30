import { describe, expect, it } from "vitest";

import type { SequenceRead } from "@/services/sequence-service";

import { formatDelay, toSequenceRow } from "./sequence-rows";

const SEQUENCE: SequenceRead = {
  id: "s1",
  name: "发布会提醒",
  createdAt: "2026-09-30T08:00:00.000Z",
  steps: [
    {
      index: 1,
      accountRole: "admin",
      text: "{event} 将于 {time} 开始，请提前准备",
      delaySeconds: 5,
    },
    {
      index: 2,
      accountRole: "member",
      text: "提醒：{event} 的资料已上传到 {location}",
      delaySeconds: 90,
    },
  ],
};

describe("toSequenceRow", () => {
  it("counts steps, collects placeholders in step order and sums delays", () => {
    expect(toSequenceRow(SEQUENCE)).toEqual({
      id: "s1",
      name: "发布会提醒",
      stepCount: 2,
      placeholders: ["event", "time", "location"],
      totalDelaySeconds: 95,
      createdAt: "2026-09-30T08:00:00.000Z",
      sequence: SEQUENCE,
    });
  });
});

describe("formatDelay", () => {
  it("formats seconds and minutes", () => {
    expect(formatDelay(0)).toBe("0 秒");
    expect(formatDelay(59)).toBe("59 秒");
    expect(formatDelay(60)).toBe("1 分");
    expect(formatDelay(95)).toBe("1 分 35 秒");
  });
});

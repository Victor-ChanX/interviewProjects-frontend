// 题目 B1 的取值规则逐条 + 与后端 resolveVars 一致的示例（题目 B1 的两步序列）。

import { describe, expect, it } from "vitest";

import {
  collectPlaceholders,
  extractPlaceholders,
  renderTemplate,
  resolveSequenceVars,
} from "@/lib/sequence-vars";

/** 题目 B1 的序列 JSON。 */
const B1_STEPS = [
  { index: 1, text: "{event} 将于 {time} 开始，请提前准备" },
  { index: 2, text: "提醒：{event} 的资料已上传到 {location}" },
];

describe("extractPlaceholders", () => {
  it("returns keys in order of first appearance, deduplicated", () => {
    expect(extractPlaceholders("{a} {b} {a} {c}")).toEqual(["a", "b", "c"]);
  });

  it("only matches [A-Za-z0-9_]+ inside braces", () => {
    expect(
      extractPlaceholders("{ok_1} {no-dash} {no space} {} {中文}"),
    ).toEqual(["ok_1"]);
  });

  it("returns [] for text without placeholders", () => {
    expect(extractPlaceholders("plain text")).toEqual([]);
  });
});

describe("collectPlaceholders", () => {
  it("merges keys across steps by step order then appearance", () => {
    expect(
      collectPlaceholders([
        { index: 2, text: "{c} {a}" },
        { index: 1, text: "{a} {b}" },
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("renderTemplate", () => {
  it("substitutes provided keys and keeps unresolved placeholders verbatim", () => {
    expect(renderTemplate("{a}-{b}-{a}", { a: "1" })).toBe("1-{b}-1");
  });

  it("does not read inherited Object properties as vars", () => {
    expect(renderTemplate("{constructor}", {})).toBe("{constructor}");
  });
});

describe("resolveSequenceVars", () => {
  it("matches the backend example: vars as start, stepVars override from that step on", () => {
    const result = resolveSequenceVars(
      B1_STEPS,
      { event: "发布会", time: "10:00", location: "共享盘/第一季度" },
      { "2": { location: "共享盘/第二季度" } },
    );

    expect(result).toEqual({
      unresolved: [],
      steps: [
        {
          index: 1,
          text: "{event} 将于 {time} 开始，请提前准备",
          entries: [
            { key: "event", value: "发布会", source: "default" },
            { key: "time", value: "10:00", source: "default" },
          ],
          rendered: "发布会 将于 10:00 开始，请提前准备",
        },
        {
          index: 2,
          text: "提醒：{event} 的资料已上传到 {location}",
          entries: [
            { key: "event", value: "发布会", source: "default" },
            { key: "location", value: "共享盘/第二季度", source: "step:2" },
          ],
          rendered: "提醒：发布会 的资料已上传到 共享盘/第二季度",
        },
      ],
    });
  });

  it('treats "" in vars as not provided', () => {
    const result = resolveSequenceVars(
      [{ index: 1, text: "{a}" }],
      { a: "" },
      {},
    );

    expect(result.unresolved).toEqual([{ stepIndex: 1, key: "a" }]);
    expect(result.steps[0]?.entries).toEqual([
      { key: "a", value: null, source: null },
    ]);
    expect(result.steps[0]?.rendered).toBe("{a}");
  });

  it("keeps a step override until a later step gives the key again", () => {
    const steps = [1, 2, 3, 4].map((index) => ({ index, text: "{k}" }));
    const result = resolveSequenceVars(
      steps,
      { k: "v0" },
      { "2": { k: "v2" }, "4": { k: "v4" } },
    );

    expect(
      result.steps
        .map((step) => step.entries[0])
        .map((e) => [e?.value, e?.source]),
    ).toEqual([
      ["v0", "default"],
      ["v2", "step:2"],
      ["v2", "step:2"],
      ["v4", "step:4"],
    ]);
  });

  it("treats \"\" in stepVars as 'do not change this step'", () => {
    const steps = [1, 2, 3].map((index) => ({ index, text: "{k}" }));
    const result = resolveSequenceVars(steps, { k: "v0" }, { "2": { k: "" } });

    expect(result.steps.map((step) => step.entries[0]?.value)).toEqual([
      "v0",
      "v0",
      "v0",
    ]);
    expect(result.steps.map((step) => step.entries[0]?.source)).toEqual([
      "default",
      "default",
      "default",
    ]);
  });

  it("a stepVars value given at a step counts for that same step", () => {
    const result = resolveSequenceVars(
      [{ index: 1, text: "{k}" }],
      {},
      { "1": { k: "v1" } },
    );

    expect(result.steps[0]?.entries).toEqual([
      { key: "k", value: "v1", source: "step:1" },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it("a stepVars value does not apply to earlier steps", () => {
    const result = resolveSequenceVars(
      [
        { index: 1, text: "{k}" },
        { index: 2, text: "{k}" },
      ],
      {},
      { "2": { k: "v2" } },
    );

    expect(result.unresolved).toEqual([{ stepIndex: 1, key: "k" }]);
    expect(result.steps[1]?.entries[0]).toEqual({
      key: "k",
      value: "v2",
      source: "step:2",
    });
  });

  it("lists every unresolved key in step order then appearance order", () => {
    const result = resolveSequenceVars(
      [
        { index: 2, text: "{c} {a}" },
        { index: 1, text: "{b} {a}" },
      ],
      { a: "1" },
      {},
    );

    expect(result.unresolved).toEqual([
      { stepIndex: 1, key: "b" },
      { stepIndex: 2, key: "c" },
    ]);
    expect(result.steps.map((step) => step.index)).toEqual([1, 2]);
  });

  it("ignores stepVars keys that point at steps not in the sequence", () => {
    const result = resolveSequenceVars(
      [{ index: 1, text: "{k}" }],
      { k: "v0" },
      { "9": { k: "v9" } },
    );

    expect(result.steps[0]?.entries).toEqual([
      { key: "k", value: "v0", source: "default" },
    ]);
  });

  it("does not list keys absent from a step's text", () => {
    const result = resolveSequenceVars(
      [{ index: 1, text: "no placeholders" }],
      { unused: "x" },
      {},
    );

    expect(result.steps[0]?.entries).toEqual([]);
    expect(result.steps[0]?.rendered).toBe("no placeholders");
  });

  it("returns empty steps for an empty sequence", () => {
    expect(resolveSequenceVars([], { a: "1" }, {})).toEqual({
      steps: [],
      unresolved: [],
    });
  });
});

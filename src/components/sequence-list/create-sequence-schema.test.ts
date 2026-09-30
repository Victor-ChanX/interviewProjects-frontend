import { describe, expect, it } from "vitest";

import {
  createSequenceSchema,
  EMPTY_CREATE_FORM,
  toSequenceDefinitionPayload,
} from "./create-sequence-schema";

/** 出错的字段路径（去重：同一字段可能同时命中 min 与 regex）。 */
function failingPaths(result: {
  error?: { issues: { path: PropertyKey[] }[] };
}) {
  return [
    ...new Set(
      (result.error?.issues ?? []).map((issue) => issue.path.join(".")),
    ),
  ];
}

describe("createSequenceSchema", () => {
  it("coerces delaySeconds from the input string and trims text", () => {
    const result = createSequenceSchema.safeParse({
      name: " 欢迎 ",
      steps: [{ accountRole: "member", text: " hi ", delaySeconds: "5" }],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "欢迎",
      steps: [{ accountRole: "member", text: "hi", delaySeconds: 5 }],
    });
  });

  it("rejects an empty name, no steps, negative / fractional delays, and blank text", () => {
    const result = createSequenceSchema.safeParse({
      name: "",
      steps: [{ accountRole: "admin", text: "  ", delaySeconds: "-1.5" }],
    });

    expect(result.success).toBe(false);
    expect(failingPaths(result)).toEqual([
      "name",
      "steps.0.text",
      "steps.0.delaySeconds",
    ]);
    expect(
      createSequenceSchema.safeParse({ name: "x", steps: [] }).success,
    ).toBe(false);
  });
});

describe("toSequenceDefinitionPayload", () => {
  it("numbers steps from 1 by position", () => {
    expect(
      toSequenceDefinitionPayload({
        name: "欢迎",
        steps: [
          { accountRole: "admin", text: "a", delaySeconds: 1 },
          { accountRole: "member", text: "b", delaySeconds: 2 },
        ],
      }),
    ).toEqual({
      name: "欢迎",
      steps: [
        { index: 1, accountRole: "admin", text: "a", delaySeconds: 1 },
        { index: 2, accountRole: "member", text: "b", delaySeconds: 2 },
      ],
    });
  });
});

describe("EMPTY_CREATE_FORM", () => {
  it("starts with one admin step and no delay", () => {
    expect(EMPTY_CREATE_FORM).toEqual({
      name: "",
      steps: [{ accountRole: "admin", text: "", delaySeconds: 0 }],
    });
  });
});

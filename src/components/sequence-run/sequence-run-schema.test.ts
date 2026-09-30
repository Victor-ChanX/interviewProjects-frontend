import { describe, expect, it } from "vitest";

import {
  createSequenceSchema,
  startSequenceRunSchema,
  toSequenceDefinitionPayload,
  toStartSequenceRunPayload,
} from "@/components/sequence-run/sequence-run-schema";

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

describe("startSequenceRunSchema", () => {
  it("requires a sequence and validates var keys", () => {
    const result = startSequenceRunSchema.safeParse({
      sequenceId: "",
      vars: [{ key: "bad-key", value: "x" }],
      stepVars: [{ stepIndex: "0", key: "", value: "" }],
    });

    expect(result.success).toBe(false);
    expect(failingPaths(result)).toEqual([
      "sequenceId",
      "vars.0.key",
      "stepVars.0.stepIndex",
      "stepVars.0.key",
    ]);
  });

  it("keeps empty values (they carry B1 semantics) and accepts empty row lists", () => {
    const result = startSequenceRunSchema.safeParse({
      sequenceId: "s1",
      vars: [{ key: "event", value: "" }],
      stepVars: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.vars).toEqual([{ key: "event", value: "" }]);
  });
});

describe("toStartSequenceRunPayload", () => {
  it("folds rows into { vars, stepVars } keyed by step index", () => {
    expect(
      toStartSequenceRunPayload({
        sequenceId: "s1",
        vars: [
          { key: "event", value: "发布会" },
          { key: "time", value: "" },
        ],
        stepVars: [
          { stepIndex: "2", key: "location", value: "共享盘" },
          { stepIndex: "2", key: "event", value: "复盘" },
          { stepIndex: "3", key: "location", value: "" },
        ],
      }),
    ).toEqual({
      sequenceId: "s1",
      vars: { event: "发布会", time: "" },
      stepVars: {
        "2": { location: "共享盘", event: "复盘" },
        "3": { location: "" },
      },
    });
  });

  it("lets a later duplicate row win", () => {
    expect(
      toStartSequenceRunPayload({
        sequenceId: "s1",
        vars: [
          { key: "k", value: "first" },
          { key: "k", value: "second" },
        ],
        stepVars: [],
      }).vars,
    ).toEqual({ k: "second" });
  });
});

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

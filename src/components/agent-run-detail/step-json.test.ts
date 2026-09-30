import { describe, expect, it } from "vitest";

import { formatJson, summarizeJson } from "./step-json";

describe("summarizeJson", () => {
  it("renders compact JSON when it fits", () => {
    expect(summarizeJson({ text: "hi", n: 1 })).toBe('{"text":"hi","n":1}');
  });

  it("truncates to max characters and appends an ellipsis", () => {
    expect(summarizeJson({ text: "abcdefghij" }, 10)).toBe('{"text":"a…');
  });

  it("keeps a string of exactly max characters untouched", () => {
    expect(summarizeJson("abcdefgh", 10)).toBe('"abcdefgh"');
  });

  it("gives a dash for null / undefined (protocol error steps)", () => {
    expect(summarizeJson(null)).toBe("-");
    expect(summarizeJson(undefined)).toBe("-");
  });
});

describe("formatJson", () => {
  it("pretty-prints with two-space indentation", () => {
    expect(formatJson({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
  });

  it("gives a dash for null", () => {
    expect(formatJson(null)).toBe("-");
  });
});

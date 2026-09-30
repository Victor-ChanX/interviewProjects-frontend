import { describe, expect, it } from "vitest";

import { bytesToBase64 } from "@/lib/base64";

describe("bytesToBase64", () => {
  it("encodes bytes the same way Node's Buffer does", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]);

    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles inputs larger than one chunk and the empty input", () => {
    const big = new Uint8Array(70_000).map((_, i) => i % 256);

    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString("base64"));
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});

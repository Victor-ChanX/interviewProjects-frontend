import { describe, expect, it } from "vitest";

import {
  STATUS_TONE_CLASS,
  STATUS_TONE_DOT_CLASS,
  STATUS_TONE_TEXT_CLASS,
  STATUS_TONES,
} from "@/lib/status-tone";

describe("status tones", () => {
  it("gives every tone a badge, dot and text class", () => {
    for (const tone of STATUS_TONES) {
      expect(STATUS_TONE_CLASS[tone]).toBeTruthy();
      expect(STATUS_TONE_DOT_CLASS[tone]).toMatch(/^bg-/);
      expect(STATUS_TONE_TEXT_CLASS[tone]).toMatch(/^text-/);
    }
  });

  it("only uses theme tokens, never raw palette colors", () => {
    const all = [
      ...Object.values(STATUS_TONE_CLASS),
      ...Object.values(STATUS_TONE_DOT_CLASS),
      ...Object.values(STATUS_TONE_TEXT_CLASS),
    ].join(" ");

    expect(all).not.toMatch(
      /-(red|green|amber|yellow|blue|slate|gray|zinc|neutral|stone)-\d/,
    );
    expect(STATUS_TONE_CLASS.danger).toContain("text-destructive");
    expect(STATUS_TONE_CLASS.success).toContain("text-success");
  });
});

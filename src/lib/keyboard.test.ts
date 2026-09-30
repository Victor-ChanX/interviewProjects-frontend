import { describe, expect, it, vi } from "vitest";

import { preventEnterSubmit } from "@/lib/keyboard";

describe("preventEnterSubmit", () => {
  it("blocks the implicit form submit on Enter", () => {
    const preventDefault = vi.fn();

    expect(preventEnterSubmit({ key: "Enter", preventDefault })).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("leaves every other key alone", () => {
    const preventDefault = vi.fn();

    for (const key of ["a", "Escape", "ArrowDown", "Tab", " "])
      expect(preventEnterSubmit({ key, preventDefault })).toBe(false);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});

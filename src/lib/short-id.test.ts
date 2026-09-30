import { describe, expect, it } from "vitest";

import { groupDisplayName, shortId } from "@/lib/short-id";

describe("shortId", () => {
  it("keeps short ids as-is", () => {
    expect(shortId("acc-1")).toBe("acc-1");
    expect(shortId("g_5ffed3d96722")).toBe("g_5ffed3d96722");
    expect(shortId("")).toBe("");
  });

  it("abbreviates UUIDs to their tail (the head is a shared timestamp)", () => {
    expect(shortId("01a0f2e4-bd5c-771a-9fc1-cd66fef966de")).toBe("…fef966de");
    expect(shortId("0123456789abcdefg")).toBe("…9abcdefg");
    expect(shortId("0123456789abcdef")).toBe("0123456789abcdef");
  });
});

describe("groupDisplayName", () => {
  it("prefers the gateway group id", () => {
    expect(
      groupDisplayName({
        id: "01a0f2e4-bd5c-771a-9fc1-cd66fef966de",
        gatewayGroupId: "g_5ffed3d96722",
      }),
    ).toBe("g_5ffed3d96722");
  });

  it("falls back to the abbreviated local id", () => {
    expect(
      groupDisplayName({
        id: "01a0f2e4-bd5c-771a-9fc1-cd66fef966de",
        gatewayGroupId: null,
      }),
    ).toBe("…fef966de");
  });
});

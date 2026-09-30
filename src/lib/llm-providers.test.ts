import { describe, expect, it } from "vitest";

import {
  getLlmProviderLabel,
  isLlmProviderId,
  LLM_PROVIDER_IDS,
  LLM_PROVIDERS,
} from "@/lib/llm-providers";

describe("LLM_PROVIDERS", () => {
  it("lists exactly Claude and Gemini, in order", () => {
    expect(LLM_PROVIDERS).toEqual([
      { id: "anthropic", label: "Claude（Anthropic）" },
      { id: "gemini", label: "Gemini（Google）" },
    ]);
  });

  it("covers every provider id exactly once", () => {
    expect(LLM_PROVIDERS.map((provider) => provider.id)).toEqual([
      ...LLM_PROVIDER_IDS,
    ]);
  });
});

describe("isLlmProviderId", () => {
  it("accepts only the two provider ids", () => {
    expect(isLlmProviderId("anthropic")).toBe(true);
    expect(isLlmProviderId("gemini")).toBe(true);
    expect(isLlmProviderId("")).toBe(false);
    expect(isLlmProviderId("openai")).toBe(false);
    expect(isLlmProviderId("Anthropic")).toBe(false);
    expect(isLlmProviderId(null)).toBe(false);
    expect(isLlmProviderId(undefined)).toBe(false);
  });
});

describe("getLlmProviderLabel", () => {
  it("returns the label by id, '-' for unknown or missing ids", () => {
    expect(getLlmProviderLabel("anthropic")).toBe("Claude（Anthropic）");
    expect(getLlmProviderLabel("gemini")).toBe("Gemini（Google）");
    expect(getLlmProviderLabel("openai")).toBe("-");
    expect(getLlmProviderLabel(null)).toBe("-");
    expect(getLlmProviderLabel(undefined)).toBe("-");
  });
});

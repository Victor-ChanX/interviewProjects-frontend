import { describe, expect, it } from "vitest";

import {
  CUSTOM_PROVIDER_ID,
  findLlmProviderId,
  getLlmProvider,
  LLM_PROVIDERS,
  normalizeLlmBaseUrl,
} from "@/lib/llm-providers";

describe("LLM_PROVIDERS", () => {
  it("lists the presets in order with officially documented base URLs", () => {
    expect(LLM_PROVIDERS).toEqual([
      {
        id: "deepseek",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com",
      },
      {
        id: "moonshot",
        label: "Kimi（Moonshot）",
        baseUrl: "https://api.moonshot.ai/v1",
      },
      {
        id: "mimo",
        label: "小米 MiMo",
        baseUrl: "https://api.xiaomimimo.com/v1",
      },
      {
        id: "gemini",
        label: "Gemini（OpenAI 兼容）",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      },
      { id: "custom", label: "自定义", baseUrl: "" },
    ]);
  });

  it("has unique ids", () => {
    const ids = LLM_PROVIDERS.map((provider) => provider.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("normalizeLlmBaseUrl", () => {
  it("trims whitespace and trailing slashes only", () => {
    expect(normalizeLlmBaseUrl("  https://a.com/v1//  ")).toBe(
      "https://a.com/v1",
    );
    expect(normalizeLlmBaseUrl("https://a.com/v1")).toBe("https://a.com/v1");
    expect(normalizeLlmBaseUrl("")).toBe("");
  });
});

describe("getLlmProvider", () => {
  it("returns the preset by id, undefined for unknown ids", () => {
    expect(getLlmProvider("deepseek")?.baseUrl).toBe(
      "https://api.deepseek.com",
    );
    expect(getLlmProvider("nope")).toBeUndefined();
  });
});

describe("findLlmProviderId", () => {
  it("matches a saved base URL to its preset, ignoring the trailing slash", () => {
    expect(findLlmProviderId("https://api.moonshot.ai/v1")).toBe("moonshot");
    // 后端保存时去掉了末尾的 /，Gemini 预设带 /，仍要认出来。
    expect(
      findLlmProviderId(
        "https://generativelanguage.googleapis.com/v1beta/openai",
      ),
    ).toBe("gemini");
  });

  it("falls back to custom for unknown, empty or missing URLs", () => {
    expect(findLlmProviderId("https://llm.example.com/v1")).toBe(
      CUSTOM_PROVIDER_ID,
    );
    expect(findLlmProviderId("")).toBe(CUSTOM_PROVIDER_ID);
    expect(findLlmProviderId(null)).toBe(CUSTOM_PROVIDER_ID);
    expect(findLlmProviderId(undefined)).toBe(CUSTOM_PROVIDER_ID);
  });
});

import { describe, expect, it } from "vitest";

import {
  BASE_URL_INVALID_MESSAGE,
  BASE_URL_REQUIRED_MESSAGE,
  llmSettingsSchema,
  MODEL_REQUIRED_MESSAGE,
  needsNewApiKey,
  toListLlmModelsPayload,
  toLlmFormValues,
  toSaveLlmSettingsPayload,
} from "@/components/llm-settings/llm-settings-schema";
import type { LlmSettingsRead } from "@/services/llm-settings-service";

const SAVED: LlmSettingsRead = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  auditModel: null,
  hasApiKey: true,
  apiKeyHint: "sk-…abcd",
  updatedAt: "2026-09-30T00:00:00.000Z",
  source: "file",
  supported: true,
};

const VALID = {
  providerId: "deepseek",
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-chat",
  auditModel: "",
};

function messages(input: unknown): string[] {
  const result = llmSettingsSchema.safeParse(input);

  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("llmSettingsSchema", () => {
  it("accepts http and https base URLs and trims every text field", () => {
    expect(
      llmSettingsSchema.parse({
        ...VALID,
        baseUrl: "  http://localhost:8000/v1 ",
        apiKey: " sk-x ",
        model: " m ",
        auditModel: " a ",
      }),
    ).toEqual({
      providerId: "deepseek",
      baseUrl: "http://localhost:8000/v1",
      apiKey: "sk-x",
      model: "m",
      auditModel: "a",
    });
  });

  it("requires a base URL", () => {
    expect(messages({ ...VALID, baseUrl: "   " })).toEqual([
      BASE_URL_REQUIRED_MESSAGE,
    ]);
  });

  it("rejects non-http(s) and malformed URLs", () => {
    for (const baseUrl of [
      "ftp://api.deepseek.com",
      "api.deepseek.com",
      "javascript:alert(1)",
      "https://",
    ])
      expect(messages({ ...VALID, baseUrl })).toEqual([
        BASE_URL_INVALID_MESSAGE,
      ]);
  });

  it("requires the chat model but not the audit model or the key", () => {
    expect(messages({ ...VALID, model: " " })).toEqual([
      MODEL_REQUIRED_MESSAGE,
    ]);
    expect(messages({ ...VALID, auditModel: "", apiKey: "" })).toEqual([]);
  });
});

describe("toLlmFormValues", () => {
  it("fills from saved settings, derives the preset and never fills the key", () => {
    expect(
      toLlmFormValues({ ...SAVED, auditModel: "deepseek-reasoner" }),
    ).toEqual({
      providerId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
      model: "deepseek-chat",
      auditModel: "deepseek-reasoner",
    });
  });

  it("starts empty on the custom preset when nothing is configured", () => {
    expect(toLlmFormValues(undefined)).toEqual({
      providerId: "custom",
      baseUrl: "",
      apiKey: "",
      model: "",
      auditModel: "",
    });
    expect(
      toLlmFormValues({
        ...SAVED,
        baseUrl: null,
        model: null,
        hasApiKey: false,
        apiKeyHint: null,
        updatedAt: null,
        source: "none",
      }),
    ).toEqual({
      providerId: "custom",
      baseUrl: "",
      apiKey: "",
      model: "",
      auditModel: "",
    });
  });
});

describe("needsNewApiKey", () => {
  it("is false only when a key is saved for the same base URL (trailing slash ignored)", () => {
    expect(needsNewApiKey("https://api.deepseek.com/", SAVED)).toBe(false);
    expect(needsNewApiKey("https://api.moonshot.ai/v1", SAVED)).toBe(true);
    expect(needsNewApiKey("https://api.deepseek.com", undefined)).toBe(true);
    expect(
      needsNewApiKey("https://api.deepseek.com", {
        ...SAVED,
        hasApiKey: false,
      }),
    ).toBe(true);
  });
});

describe("toSaveLlmSettingsPayload", () => {
  it("omits an empty key and sends null for an empty audit model", () => {
    expect(toSaveLlmSettingsPayload(VALID)).toEqual({
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      auditModel: null,
    });
  });

  it("sends the key and the audit model when filled", () => {
    expect(
      toSaveLlmSettingsPayload({
        ...VALID,
        apiKey: "sk-new",
        auditModel: "deepseek-reasoner",
      }),
    ).toEqual({
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-new",
      model: "deepseek-chat",
      auditModel: "deepseek-reasoner",
    });
  });
});

describe("toListLlmModelsPayload", () => {
  it("trims both fields and omits an empty key", () => {
    expect(toListLlmModelsPayload(" https://a.com/v1 ", "  ")).toEqual({
      baseUrl: "https://a.com/v1",
    });
    expect(toListLlmModelsPayload("https://a.com/v1", " sk-x ")).toEqual({
      baseUrl: "https://a.com/v1",
      apiKey: "sk-x",
    });
  });
});

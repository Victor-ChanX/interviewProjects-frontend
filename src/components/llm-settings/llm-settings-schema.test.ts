import { describe, expect, it } from "vitest";

import {
  llmSettingsSchema,
  MODEL_REQUIRED_MESSAGE,
  needsNewApiKey,
  PROVIDER_REQUIRED_MESSAGE,
  toListLlmModelsPayload,
  toLlmFormValues,
  toSaveLlmSettingsPayload,
} from "@/components/llm-settings/llm-settings-schema";
import type { LlmSettingsRead } from "@/services/llm-settings-service";

const SAVED: LlmSettingsRead = {
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  auditModel: null,
  hasApiKey: true,
  apiKeyHint: "sk-…abcd",
  updatedAt: "2026-09-30T00:00:00.000Z",
  source: "file",
  supported: true,
};

const VALID = {
  provider: "anthropic" as const,
  apiKey: "",
  model: "claude-sonnet-4-5",
  auditModel: "",
};

function messages(input: unknown): string[] {
  const result = llmSettingsSchema.safeParse(input);

  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("llmSettingsSchema", () => {
  it("accepts both providers and trims every text field", () => {
    expect(
      llmSettingsSchema.parse({
        provider: "gemini",
        apiKey: " key-x ",
        model: " m ",
        auditModel: " a ",
      }),
    ).toEqual({
      provider: "gemini",
      apiKey: "key-x",
      model: "m",
      auditModel: "a",
    });
    expect(messages(VALID)).toEqual([]);
  });

  it("requires a provider, and only Claude or Gemini", () => {
    for (const provider of ["", "openai", "claude", "Anthropic", "custom"])
      expect(messages({ ...VALID, provider })).toEqual([
        PROVIDER_REQUIRED_MESSAGE,
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
  it("fills from saved settings and never fills the key", () => {
    expect(
      toLlmFormValues({ ...SAVED, auditModel: "claude-haiku-4-5" }),
    ).toEqual({
      provider: "anthropic",
      apiKey: "",
      model: "claude-sonnet-4-5",
      auditModel: "claude-haiku-4-5",
    });
  });

  it("starts with no provider selected when nothing is configured", () => {
    const empty = { provider: "", apiKey: "", model: "", auditModel: "" };

    expect(toLlmFormValues(undefined)).toEqual(empty);
    expect(
      toLlmFormValues({
        ...SAVED,
        provider: null,
        model: null,
        hasApiKey: false,
        apiKeyHint: null,
        updatedAt: null,
        source: "none",
      }),
    ).toEqual(empty);
  });
});

describe("needsNewApiKey", () => {
  it("is false only when a key is saved for the same provider", () => {
    expect(needsNewApiKey("anthropic", SAVED)).toBe(false);
    expect(needsNewApiKey("gemini", SAVED)).toBe(true);
    expect(needsNewApiKey("anthropic", undefined)).toBe(true);
    expect(needsNewApiKey("anthropic", { ...SAVED, hasApiKey: false })).toBe(
      true,
    );
    expect(needsNewApiKey("anthropic", { ...SAVED, provider: null })).toBe(
      true,
    );
  });
});

describe("toSaveLlmSettingsPayload", () => {
  it("omits an empty key and sends null for an empty audit model", () => {
    expect(toSaveLlmSettingsPayload(VALID)).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      auditModel: null,
    });
  });

  it("sends the key and the audit model when filled", () => {
    expect(
      toSaveLlmSettingsPayload({
        ...VALID,
        provider: "gemini",
        apiKey: "key-new",
        model: "gemini-2.5-pro",
        auditModel: "gemini-2.5-flash",
      }),
    ).toEqual({
      provider: "gemini",
      apiKey: "key-new",
      model: "gemini-2.5-pro",
      auditModel: "gemini-2.5-flash",
    });
  });
});

describe("toListLlmModelsPayload", () => {
  it("sends the provider, trims the key and omits it when empty", () => {
    expect(toListLlmModelsPayload("gemini", "  ")).toEqual({
      provider: "gemini",
    });
    expect(toListLlmModelsPayload("anthropic", " key-x ")).toEqual({
      provider: "anthropic",
      apiKey: "key-x",
    });
  });
});

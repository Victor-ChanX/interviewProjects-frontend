import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api,
}));

import { RequestError } from "@/lib/request";
import {
  getLlmErrorCode,
  getLlmSettings,
  listLlmModels,
  saveLlmSettings,
  testLlmConnection,
} from "@/services/llm-settings-service";

beforeEach(() => {
  vi.clearAllMocks();
});

const SETTINGS = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  auditModel: null,
  hasApiKey: true,
  apiKeyHint: "sk-…abcd",
  updatedAt: "2026-09-30T00:00:00.000Z",
  source: "file" as const,
  supported: true,
};

describe("getLlmSettings", () => {
  it("GETs /api/llm/settings and returns the body as-is", async () => {
    api.get.mockResolvedValue(SETTINGS);

    await expect(getLlmSettings()).resolves.toEqual(SETTINGS);
    expect(api.get).toHaveBeenCalledWith("/api/llm/settings");
  });
});

describe("saveLlmSettings", () => {
  it("PUTs the payload to /api/llm/settings", async () => {
    const payload = {
      baseUrl: "https://api.deepseek.com",
      apiKey: "sk-test",
      model: "deepseek-chat",
      auditModel: null,
    };

    api.put.mockResolvedValue(SETTINGS);

    await expect(saveLlmSettings(payload)).resolves.toEqual(SETTINGS);
    expect(api.put).toHaveBeenCalledWith("/api/llm/settings", payload);
  });
});

describe("listLlmModels", () => {
  it("POSTs { baseUrl, apiKey? } to /api/llm/models", async () => {
    const body = {
      items: [{ id: "deepseek-chat", ownedBy: "deepseek" }],
      total: 1,
    };

    api.post.mockResolvedValue(body);

    await expect(
      listLlmModels({ baseUrl: "https://api.deepseek.com" }),
    ).resolves.toEqual(body);
    expect(api.post).toHaveBeenCalledWith("/api/llm/models", {
      baseUrl: "https://api.deepseek.com",
    });
  });
});

describe("testLlmConnection", () => {
  it("POSTs /api/llm/test without a body", async () => {
    const result = { ok: true, latencyMs: 321, model: "m", message: "ok" };

    api.post.mockResolvedValue(result);

    await expect(testLlmConnection()).resolves.toEqual(result);
    expect(api.post).toHaveBeenCalledWith("/api/llm/test");
  });
});

describe("getLlmErrorCode", () => {
  it("reads the envelope code from a RequestError", () => {
    expect(
      getLlmErrorCode(
        new RequestError(422, "x", undefined, "LLM_UPSTREAM_UNAUTHORIZED"),
      ),
    ).toBe("LLM_UPSTREAM_UNAUTHORIZED");
  });

  it("returns null for RequestErrors without a code and for other errors", () => {
    expect(getLlmErrorCode(new RequestError(500, "x"))).toBeNull();
    expect(getLlmErrorCode(new Error("x"))).toBeNull();
    expect(getLlmErrorCode("x")).toBeNull();
  });
});

// @vitest-environment jsdom
// LLM 设置 hook：获取模型列表后可选；按错误码给中文提示并标在 key 输入框上；本地先拦「需要新 key」；
// 保存后清空 key（且 key 不进 query / mutation 缓存、不进 storage）；viewer 只读、unsupported 禁用写操作。
// service 层与 sonner 都 mock。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  API_KEY_REQUIRED_MESSAGE,
  BASE_URL_INVALID_MESSAGE,
  UNSUPPORTED_MESSAGE,
} from "@/components/llm-settings/llm-settings-schema";
import {
  describeLlmError,
  useLlmSettings,
} from "@/components/llm-settings/use-llm-settings";
import { RequestError } from "@/lib/request";
import type { LlmSettingsRead } from "@/services/llm-settings-service";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const service = vi.hoisted(() => ({
  getLlmSettings: vi.fn(),
  saveLlmSettings: vi.fn(),
  listLlmModels: vi.fn(),
  testLlmConnection: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/services/llm-settings-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/llm-settings-service")>()),
  ...service,
}));

const SECRET = "sk-test-not-a-real-key-1234";

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

const NONE: LlmSettingsRead = {
  baseUrl: null,
  model: null,
  auditModel: null,
  hasApiKey: false,
  apiKeyHint: null,
  updatedAt: null,
  source: "none",
  supported: true,
};

const MODELS = {
  items: [
    { id: "deepseek-chat", ownedBy: "deepseek" },
    { id: "deepseek-reasoner", ownedBy: "deepseek" },
  ],
  total: 2,
};

function setup(settings: LlmSettingsRead, canWrite = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  service.getLlmSettings.mockResolvedValue(settings);

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(() => useLlmSettings({ canWrite }), { wrapper });

  return { ...hook, queryClient };
}

/** 模拟在输入框里打字（register 的 onChange 只读 event.target）。 */
async function type(
  current: ReturnType<typeof useLlmSettings>,
  name: "apiKey" | "baseUrl",
  value: string,
) {
  await act(async () => {
    await current.register(name).onChange({
      target: { name, value },
      type: "change",
    });
  });
}

function requestError(status: number, code: string) {
  return new RequestError(status, "upstream said no", undefined, code);
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("useLlmSettings: loading", () => {
  it("exposes the saved settings and fills the form from them", async () => {
    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.settings).toEqual(SAVED));
    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    expect(result.current.providerId).toBe("deepseek");
    expect(result.current.writable).toBe(true);
    // 没获取过列表：选项里只有已保存的模型，能显示当前值。
    expect(result.current.modelOptions).toEqual(["deepseek-chat"]);
    expect(result.current.modelsFetched).toBe(false);
  });
});

describe("useLlmSettings: fetch models", () => {
  it("sends baseUrl + key and makes the fetched models selectable", async () => {
    service.listLlmModels.mockResolvedValue(MODELS);

    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    act(() => result.current.changeProvider("deepseek"));
    await type(result.current, "apiKey", SECRET);
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).toHaveBeenCalledWith({
      baseUrl: "https://api.deepseek.com",
      apiKey: SECRET,
    });
    expect(result.current.modelsFetched).toBe(true);
    expect(result.current.modelsCount).toBe(2);
    expect(result.current.modelOptions).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
    ]);

    act(() => result.current.setModel("deepseek-reasoner"));
    expect(result.current.model).toBe("deepseek-reasoner");
  });

  it("reuses the saved key (no apiKey in the body) for the same base URL", async () => {
    service.listLlmModels.mockResolvedValue(MODELS);

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).toHaveBeenCalledWith({
      baseUrl: "https://api.deepseek.com",
    });
  });

  it("blocks locally when a new key is needed, without calling the backend", async () => {
    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    act(() => result.current.changeProvider("moonshot"));
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(result.current.errors.apiKey?.message).toBe(
      API_KEY_REQUIRED_MESSAGE,
    );
  });

  it("validates the base URL before fetching", async () => {
    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    await type(result.current, "baseUrl", "api.deepseek.com");
    await type(result.current, "apiKey", SECRET);
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(result.current.errors.baseUrl?.message).toBe(
      BASE_URL_INVALID_MESSAGE,
    );
  });

  it.each([
    [
      422,
      "LLM_UPSTREAM_UNAUTHORIZED",
      "API Key 无效：服务商拒绝了这个 key，请检查后重新输入",
      true,
    ],
    [
      422,
      "LLM_API_KEY_REQUIRED",
      "需要重新输入 API Key：还没有保存过 key，或 Base URL 与已保存的不同，不能沿用",
      true,
    ],
    [
      502,
      "LLM_UPSTREAM_ERROR",
      "上游不可达：连不上服务商或服务商返回异常，请检查 Base URL 与网络",
      false,
    ],
    [409, "LLM_AGENT_UNSUPPORTED", UNSUPPORTED_MESSAGE, false],
  ])(
    "%i %s → Chinese hint (on the key field: %s)",
    async (status, code, message, onKeyField) => {
      service.listLlmModels.mockRejectedValue(requestError(status, code));

      const { result } = setup(SAVED);

      await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
      await type(result.current, "apiKey", SECRET);
      await act(() => result.current.fetchModels());

      // key 的问题只标在 key 输入框上；其它错误显示在按钮下方。
      expect(result.current.errors.apiKey?.message).toBe(
        onKeyField ? message : undefined,
      );
      expect(result.current.modelsError).toBe(onKeyField ? null : message);
      expect(result.current.modelsFetched).toBe(false);
      expect(result.current.modelsLoading).toBe(false);
    },
  );

  it("flags a list fetched for another base URL as stale and drops it on provider change", async () => {
    service.listLlmModels.mockResolvedValue(MODELS);

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    await act(() => result.current.fetchModels());
    expect(result.current.modelsStale).toBe(false);

    await type(result.current, "baseUrl", "https://api.deepseek.com/v1");
    expect(result.current.modelsStale).toBe(true);

    act(() => result.current.changeProvider("custom"));
    expect(result.current.modelsFetched).toBe(false);
    expect(result.current.model).toBe("");
  });
});

describe("useLlmSettings: save", () => {
  it("saves, updates the cache, clears the key, and never keeps the key anywhere", async () => {
    const saved = { ...SAVED, auditModel: "deepseek-reasoner" };

    service.listLlmModels.mockResolvedValue(MODELS);
    service.saveLlmSettings.mockResolvedValue(saved);

    const { result, queryClient } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    await type(result.current, "apiKey", SECRET);
    await act(() => result.current.fetchModels());
    act(() => result.current.setAuditModel("deepseek-reasoner"));
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).toHaveBeenCalledWith({
      baseUrl: "https://api.deepseek.com",
      apiKey: SECRET,
      model: "deepseek-chat",
      auditModel: "deepseek-reasoner",
    });
    expect(toast.success).toHaveBeenCalledWith("LLM 配置已保存");
    await waitFor(() => expect(result.current.settings).toEqual(saved));

    const caches = JSON.stringify([
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => [query.queryKey, query.state]),
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ]);

    expect(caches).not.toContain(SECRET);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    // key 输入框已清空：再保存一次，请求体里不再带 key（沿用已保存的）。
    await act(() => result.current.submit());
    expect(service.saveLlmSettings).toHaveBeenLastCalledWith({
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
      auditModel: "deepseek-reasoner",
    });
  });

  it("requires a chat model", async () => {
    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    act(() => result.current.changeProvider("deepseek"));
    await type(result.current, "apiKey", SECRET);
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).not.toHaveBeenCalled();
    expect(result.current.errors.model?.message).toBe("请选择对话模型");
  });

  it("toasts the Chinese hint and marks the key field on 422 LLM_API_KEY_REQUIRED", async () => {
    service.saveLlmSettings.mockRejectedValue(
      requestError(422, "LLM_API_KEY_REQUIRED"),
    );

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("deepseek-chat"));
    await act(() => result.current.submit());

    const message =
      "需要重新输入 API Key：还没有保存过 key，或 Base URL 与已保存的不同，不能沿用";

    expect(toast.error).toHaveBeenCalledWith(message);
    expect(result.current.errors.apiKey?.message).toBe(message);
    expect(result.current.saving).toBe(false);
  });
});

describe("useLlmSettings: test connection", () => {
  it("exposes ok / latency / model / message", async () => {
    const outcome = {
      ok: true,
      latencyMs: 321,
      model: "deepseek-chat",
      message: "pong",
    };

    service.testLlmConnection.mockResolvedValue(outcome);

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.writable).toBe(true));
    act(() => result.current.runTest());

    await waitFor(() => expect(result.current.testResult).toEqual(outcome));
    expect(result.current.testError).toBeNull();
  });

  it("maps a failed request to a Chinese hint", async () => {
    service.testLlmConnection.mockRejectedValue(
      requestError(502, "LLM_UPSTREAM_ERROR"),
    );

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.writable).toBe(true));
    act(() => result.current.runTest());

    await waitFor(() =>
      expect(result.current.testError).toBe(
        "上游不可达：连不上服务商或服务商返回异常，请检查 Base URL 与网络",
      ),
    );
  });
});

describe("useLlmSettings: read-only modes", () => {
  it("viewer: not writable and every write is a no-op", async () => {
    const { result } = setup(SAVED, false);

    await waitFor(() => expect(result.current.settings).toEqual(SAVED));
    expect(result.current.writable).toBe(false);

    await act(() => result.current.fetchModels());
    await act(() => result.current.submit());
    act(() => result.current.runTest());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(service.saveLlmSettings).not.toHaveBeenCalled();
    expect(service.testLlmConnection).not.toHaveBeenCalled();
  });

  it("unsupported agent: admin cannot write either", async () => {
    // 后端在 supported=false 时其余字段全是 null / false（source 也是 null）。
    const { result } = setup({ ...NONE, source: null, supported: false });

    await waitFor(() => expect(result.current.supported).toBe(false));
    expect(result.current.writable).toBe(false);

    await type(result.current, "apiKey", SECRET);
    await act(() => result.current.fetchModels());
    await act(() => result.current.submit());
    act(() => result.current.runTest());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(service.saveLlmSettings).not.toHaveBeenCalled();
    expect(service.testLlmConnection).not.toHaveBeenCalled();
  });
});

describe("describeLlmError", () => {
  it("falls back to the generic message for unknown codes and non-request errors", () => {
    expect(describeLlmError(requestError(500, "INTERNAL"), "兜底")).toBe(
      "upstream said no",
    );
    expect(describeLlmError("oops", "兜底")).toBe("oops");
    expect(describeLlmError(null, "兜底")).toBe("兜底");
  });
});

// @vitest-environment jsdom
// LLM 设置 hook：服务商只有 Claude / Gemini 且必选；获取模型列表（带 provider）后可选，下拉显示 displayName；
// 按错误码给中文提示并标在 key 输入框上；本地先拦「需要新 key」（没存过或换了服务商）；
// 保存后清空 key（且 key 不进 query / mutation 缓存、不进 storage）；viewer 只读、unsupported 禁用写操作。
// service 层与 sonner 都 mock。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  API_KEY_REQUIRED_MESSAGE,
  PROVIDER_REQUIRED_MESSAGE,
  UNSUPPORTED_MESSAGE,
} from "@/components/llm-settings/llm-settings-schema";
import {
  describeLlmError,
  toModelOptions,
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
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  auditModel: null,
  hasApiKey: true,
  apiKeyHint: "sk-…abcd",
  updatedAt: "2026-09-30T00:00:00.000Z",
  source: "file",
  supported: true,
};

const NONE: LlmSettingsRead = {
  provider: null,
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
    { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", displayName: "Claude Haiku 4.5" },
  ],
  total: 2,
};

const GEMINI_MODELS = {
  items: [{ id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" }],
  total: 1,
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

/** 模拟在 key 输入框里打字（register 的 onChange 只读 event.target）。 */
async function typeKey(
  current: ReturnType<typeof useLlmSettings>,
  value: string,
) {
  await act(async () => {
    await current.register("apiKey").onChange({
      target: { name: "apiKey", value },
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
    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    expect(result.current.provider).toBe("anthropic");
    expect(result.current.writable).toBe(true);
    // 没获取过列表：选项里只有已保存的模型（显示 id），能显示当前值。
    expect(result.current.modelOptions).toEqual([
      { value: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
    ]);
    expect(result.current.modelsFetched).toBe(false);
  });

  it("starts with no provider selected when nothing is configured", async () => {
    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    expect(result.current.provider).toBe("");
    expect(result.current.modelOptions).toEqual([]);
  });
});

describe("useLlmSettings: fetch models", () => {
  it("sends provider + key and lists models by displayName", async () => {
    service.listLlmModels.mockResolvedValue(GEMINI_MODELS);

    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    act(() => result.current.changeProvider("gemini"));
    await typeKey(result.current, SECRET);
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: SECRET,
    });
    expect(result.current.modelsFetched).toBe(true);
    expect(result.current.modelsCount).toBe(1);
    expect(result.current.modelOptions).toEqual([
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ]);

    act(() => result.current.setModel("gemini-2.5-pro"));
    expect(result.current.model).toBe("gemini-2.5-pro");
  });

  it("reuses the saved key (no apiKey in the body) for the same provider", async () => {
    service.listLlmModels.mockResolvedValue(MODELS);

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).toHaveBeenCalledWith({
      provider: "anthropic",
    });
    // 已保存的模型在列表里：按 displayName 显示，不重复。
    expect(result.current.modelOptions).toEqual([
      { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ]);
  });

  it("blocks locally when the provider changed and no new key is given", async () => {
    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    act(() => result.current.changeProvider("gemini"));
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(result.current.errors.apiKey?.message).toBe(
      API_KEY_REQUIRED_MESSAGE,
    );
  });

  it("requires a provider before fetching", async () => {
    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    await typeKey(result.current, SECRET);
    await act(() => result.current.fetchModels());

    expect(service.listLlmModels).not.toHaveBeenCalled();
    expect(result.current.errors.provider?.message).toBe(
      PROVIDER_REQUIRED_MESSAGE,
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
      "需要重新输入 API Key：还没有保存过 key，或服务商与已保存的不同，不能沿用",
      true,
    ],
    [
      502,
      "LLM_UPSTREAM_ERROR",
      "上游不可达：连不上服务商或服务商返回异常，请检查网络后重试",
      false,
    ],
    [409, "LLM_AGENT_UNSUPPORTED", UNSUPPORTED_MESSAGE, false],
  ])(
    "%i %s → Chinese hint (on the key field: %s)",
    async (status, code, message, onKeyField) => {
      service.listLlmModels.mockRejectedValue(requestError(status, code));

      const { result } = setup(SAVED);

      await waitFor(() =>
        expect(result.current.model).toBe("claude-sonnet-4-5"),
      );
      await typeKey(result.current, SECRET);
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

  it("drops the list and the chosen models on provider change", async () => {
    service.listLlmModels.mockResolvedValue(MODELS);

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    await act(() => result.current.fetchModels());
    act(() => result.current.setAuditModel("claude-haiku-4-5"));
    expect(result.current.modelsFetched).toBe(true);

    act(() => result.current.changeProvider("gemini"));
    expect(result.current.provider).toBe("gemini");
    expect(result.current.modelsFetched).toBe(false);
    expect(result.current.model).toBe("");
    expect(result.current.auditModel).toBe("");
    expect(result.current.modelOptions).toEqual([]);
  });

  it("ignores a list that arrives after the provider was switched", async () => {
    let resolve: (value: typeof MODELS) => void = () => {};

    service.listLlmModels.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));

    let pending: Promise<void> = Promise.resolve();

    act(() => {
      pending = result.current.fetchModels();
    });
    act(() => result.current.changeProvider("gemini"));
    await act(async () => {
      resolve(MODELS);
      await pending;
    });

    expect(result.current.provider).toBe("gemini");
    expect(result.current.modelsFetched).toBe(false);
    expect(result.current.modelOptions).toEqual([]);
  });
});

describe("toModelOptions", () => {
  it("labels by displayName and appends selected ids missing from the list once", () => {
    expect(
      toModelOptions(
        [
          { id: "a", displayName: "Model A" },
          { id: "b", displayName: "" },
        ],
        ["a", "saved", "", "saved"],
      ),
    ).toEqual([
      { value: "a", label: "Model A" },
      { value: "b", label: "b" },
      { value: "saved", label: "saved" },
    ]);
    expect(toModelOptions([], [])).toEqual([]);
  });
});

describe("useLlmSettings: save", () => {
  it("saves, updates the cache, clears the key, and never keeps the key anywhere", async () => {
    const saved = { ...SAVED, auditModel: "claude-haiku-4-5" };

    service.listLlmModels.mockResolvedValue(MODELS);
    service.saveLlmSettings.mockResolvedValue(saved);

    const { result, queryClient } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    await typeKey(result.current, SECRET);
    await act(() => result.current.fetchModels());
    act(() => result.current.setAuditModel("claude-haiku-4-5"));
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: SECRET,
      model: "claude-sonnet-4-5",
      auditModel: "claude-haiku-4-5",
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
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      auditModel: "claude-haiku-4-5",
    });
  });

  it("requires a provider and a chat model", async () => {
    const { result } = setup(NONE);

    await waitFor(() => expect(result.current.settings).toEqual(NONE));
    await typeKey(result.current, SECRET);
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).not.toHaveBeenCalled();
    expect(result.current.errors.provider?.message).toBe(
      PROVIDER_REQUIRED_MESSAGE,
    );
    expect(result.current.errors.model?.message).toBe("请选择对话模型");
  });

  it("switching provider needs a new key before saving", async () => {
    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    act(() => result.current.changeProvider("gemini"));
    act(() => result.current.setModel("gemini-2.5-pro"));
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).not.toHaveBeenCalled();
    expect(result.current.errors.apiKey?.message).toBe(
      API_KEY_REQUIRED_MESSAGE,
    );

    service.saveLlmSettings.mockResolvedValue({
      ...SAVED,
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
    await typeKey(result.current, SECRET);
    await act(() => result.current.submit());

    expect(service.saveLlmSettings).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: SECRET,
      model: "gemini-2.5-pro",
      auditModel: null,
    });
  });

  it("toasts the Chinese hint and marks the key field on 422 LLM_API_KEY_REQUIRED", async () => {
    service.saveLlmSettings.mockRejectedValue(
      requestError(422, "LLM_API_KEY_REQUIRED"),
    );

    const { result } = setup(SAVED);

    await waitFor(() => expect(result.current.model).toBe("claude-sonnet-4-5"));
    await act(() => result.current.submit());

    const message =
      "需要重新输入 API Key：还没有保存过 key，或服务商与已保存的不同，不能沿用";

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
      model: "claude-sonnet-4-5",
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
        "上游不可达：连不上服务商或服务商返回异常，请检查网络后重试",
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

    await typeKey(result.current, SECRET);
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

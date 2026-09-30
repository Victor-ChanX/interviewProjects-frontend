// LLM 设置端点 wrapper（后端 #19 / #21：`GET/PUT /api/llm/settings`、`POST /api/llm/models`、`POST /api/llm/test`；
// 前端 #9 / #11）。URL、方法、请求体都在这里（api.wrapper-owns-url）；类型从 api.generated 派生（api.types-derived）。
// 服务商只有 Claude（anthropic）与 Gemini（gemini），见 src/lib/llm-providers.ts。
//
// API key 明文只出现在 saveLlmSettings / listLlmModels 的请求体里：响应永远只有 hasApiKey + apiKeyHint，
// 所以 GET 的结果可以放进 query 缓存；带 key 的两个调用由 hook 用普通 async 发，不经 useQuery / useMutation
// （两者都会把参数留在缓存里）。
//
// 业务拒绝按 RequestError.code 分流（不比对文案）：
// - 422 LLM_API_KEY_REQUIRED：没存过 key，或服务商变了不能沿用已存的 key
// - 422 LLM_UPSTREAM_UNAUTHORIZED：服务商拒绝了这个 key
// - 503 LLM_UPSTREAM_ERROR：服务商不可达 / 返回异常（后端 #50 起；经 Cloudflare 时 502 的原因会被吞掉）
// - 409 LLM_AGENT_UNSUPPORTED：AGENT_URL 指向的服务不支持在线配置（如 Agent 模拟器）

import { api, RequestError } from "@/lib/api";
import type { components, paths } from "@/types/api.generated";

/**
 * 当前生效配置。provider：null = 还没配置；source：file = 控制台保存过、none = 还没配置过；
 * supported=false（AGENT_URL 指向的不是 llm-agent）时其余字段为 null / false，source 也是 null。
 */
export type LlmSettingsRead = components["schemas"]["LlmSettingsRead"];

export type LlmSettingsSource = components["schemas"]["LlmConfigSource"];

/** `PUT /api/llm/settings` 的请求体：apiKey 省略 = 沿用已存的（仅当 provider 没变）；auditModel null = 同对话模型。 */
export type SaveLlmSettingsPayload =
  paths["/api/llm/settings"]["put"]["requestBody"]["content"]["application/json"];

/** `POST /api/llm/models` 的请求体：{ provider, apiKey? }。 */
export type ListLlmModelsPayload =
  paths["/api/llm/models"]["post"]["requestBody"]["content"]["application/json"];

export type LlmModelListResponse =
  components["schemas"]["LlmModelListResponse"];

/** 模型：id 是保存用的值，displayName 是下拉里显示的名字（服务商没给时等于 id）。 */
export type LlmModel = components["schemas"]["LlmModelRead"];

/** 失败也是 200：ok=false + message 说明原因；model 可能为 null（还没配置）。 */
export type LlmTestResult = components["schemas"]["LlmTestResult"];

export const LLM_API_KEY_REQUIRED_CODE = "LLM_API_KEY_REQUIRED";

export const LLM_UPSTREAM_UNAUTHORIZED_CODE = "LLM_UPSTREAM_UNAUTHORIZED";

export const LLM_UPSTREAM_ERROR_CODE = "LLM_UPSTREAM_ERROR";

export const LLM_AGENT_UNSUPPORTED_CODE = "LLM_AGENT_UNSUPPORTED";

const LLM_SETTINGS_URL = "/api/llm/settings";

const LLM_MODELS_URL = "/api/llm/models";

const LLM_TEST_URL = "/api/llm/test";

export function getLlmSettings(): Promise<LlmSettingsRead> {
  return api.get<LlmSettingsRead>(LLM_SETTINGS_URL);
}

export function saveLlmSettings(
  payload: SaveLlmSettingsPayload,
): Promise<LlmSettingsRead> {
  return api.put<LlmSettingsRead>(LLM_SETTINGS_URL, payload);
}

export function listLlmModels(
  payload: ListLlmModelsPayload,
): Promise<LlmModelListResponse> {
  return api.post<LlmModelListResponse>(LLM_MODELS_URL, payload);
}

/** 用已保存的配置发一次最小请求；不带参数。 */
export function testLlmConnection(): Promise<LlmTestResult> {
  return api.post<LlmTestResult>(LLM_TEST_URL);
}

/** 错误信封里的机器码（只认 RequestError）；其它错误 → null。 */
export function getLlmErrorCode(error: unknown): string | null {
  return error instanceof RequestError ? error.code : null;
}

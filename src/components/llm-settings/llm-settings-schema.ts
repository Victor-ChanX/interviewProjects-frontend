// LLM 设置表单的校验（校验权威只有 zod 一处；<form noValidate>）与「表单值 ↔ 接口负载」的纯转换。
//
// - baseUrl 必须是 http(s) 地址；比较「是不是同一个地址」按后端口径（去首尾空白与末尾 /）。
// - apiKey 留空 = 沿用已保存的 key，但只在已存过 key 且 baseUrl 没变时可以（否则后端 422 LLM_API_KEY_REQUIRED，
//   这里先在本地拦一道：needsNewApiKey）。
// - model 保存时必选；auditModel 留空 = 同对话模型（发 null）。

import { z } from "zod";

import { findLlmProviderId, normalizeLlmBaseUrl } from "@/lib/llm-providers";
import type {
  ListLlmModelsPayload,
  LlmSettingsRead,
  SaveLlmSettingsPayload,
} from "@/services/llm-settings-service";

export const BASE_URL_REQUIRED_MESSAGE = "请填写 Base URL";

export const BASE_URL_INVALID_MESSAGE =
  "Base URL 必须是 http:// 或 https:// 开头的地址";

export const MODEL_REQUIRED_MESSAGE = "请选择对话模型";

export const API_KEY_REQUIRED_MESSAGE =
  "请填写 API Key：还没有保存过 key，或 Base URL 与已保存的不同，不能沿用";

export const UNSUPPORTED_MESSAGE =
  "当前 Agent 服务不支持在线配置（AGENT_URL 指向的是模拟器），请启动 LLM Agent 服务";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}

export const baseUrlSchema = z
  .string()
  .trim()
  .min(1, BASE_URL_REQUIRED_MESSAGE)
  // 空串只报「请填写」一条。
  .refine(
    (value) => value === "" || isHttpUrl(value),
    BASE_URL_INVALID_MESSAGE,
  );

export const llmSettingsSchema = z.object({
  providerId: z.string(),
  baseUrl: baseUrlSchema,
  apiKey: z.string().trim(),
  model: z.string().trim().min(1, MODEL_REQUIRED_MESSAGE),
  auditModel: z.string().trim(),
});

export type LlmSettingsFormValues = z.infer<typeof llmSettingsSchema>;

/** 表单初值：来自已保存的配置；key 永远从空开始（后端只给掩码）。 */
export function toLlmFormValues(
  settings: LlmSettingsRead | undefined,
): LlmSettingsFormValues {
  return {
    providerId: findLlmProviderId(settings?.baseUrl),
    baseUrl: settings?.baseUrl ?? "",
    apiKey: "",
    model: settings?.model ?? "",
    auditModel: settings?.auditModel ?? "",
  };
}

/** 这次请求必须带新 key：没存过 key，或 baseUrl 与已保存的不同（后端不会把旧 key 发给新地址）。 */
export function needsNewApiKey(
  baseUrl: string,
  settings: LlmSettingsRead | undefined,
): boolean {
  if (!settings?.hasApiKey) return true;

  return (
    normalizeLlmBaseUrl(baseUrl) !== normalizeLlmBaseUrl(settings.baseUrl ?? "")
  );
}

/** apiKey 空串 → 省略（沿用已存的）；auditModel 空串 → null（同对话模型）。 */
export function toSaveLlmSettingsPayload(
  values: LlmSettingsFormValues,
): SaveLlmSettingsPayload {
  return {
    baseUrl: values.baseUrl,
    ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    model: values.model,
    auditModel: values.auditModel || null,
  };
}

export function toListLlmModelsPayload(
  baseUrl: string,
  apiKey: string,
): ListLlmModelsPayload {
  const key = apiKey.trim();

  return { baseUrl: baseUrl.trim(), ...(key ? { apiKey: key } : {}) };
}

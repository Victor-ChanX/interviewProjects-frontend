// LLM 设置表单的校验（校验权威只有 zod 一处；<form noValidate>）与「表单值 ↔ 接口负载」的纯转换。
//
// - provider 必选，只能是 Claude（anthropic）或 Gemini（gemini）；表单里空串 = 还没选。
// - apiKey 留空 = 沿用已保存的 key，但只在已存过 key 且服务商没变时可以（否则后端 422 LLM_API_KEY_REQUIRED，
//   这里先在本地拦一道：needsNewApiKey）。
// - model 保存时必选；auditModel 留空 = 同对话模型（发 null）。

import { z } from "zod";

import { LLM_PROVIDER_IDS, type LlmProviderId } from "@/lib/llm-providers";
import type {
  ListLlmModelsPayload,
  LlmSettingsRead,
  SaveLlmSettingsPayload,
} from "@/services/llm-settings-service";

export const PROVIDER_REQUIRED_MESSAGE = "请选择服务商";

export const MODEL_REQUIRED_MESSAGE = "请选择对话模型";

export const API_KEY_REQUIRED_MESSAGE =
  "请填写 API Key：还没有保存过 key，或服务商与已保存的不同，不能沿用";

export const UNSUPPORTED_MESSAGE =
  "当前 Agent 服务不支持在线配置（AGENT_URL 指向的是模拟器），请启动 LLM Agent 服务";

export const llmSettingsSchema = z.object({
  // 输入是字符串（下拉的「请选择」是空串），校验后收窄成服务商 id。
  provider: z
    .string()
    .pipe(z.enum(LLM_PROVIDER_IDS, { error: PROVIDER_REQUIRED_MESSAGE })),
  apiKey: z.string().trim(),
  model: z.string().trim().min(1, MODEL_REQUIRED_MESSAGE),
  auditModel: z.string().trim(),
});

/** 表单里的值（RHF 状态）：provider 可能还是空串。 */
export type LlmSettingsFormInput = z.input<typeof llmSettingsSchema>;

/** 校验通过后的值（提交回调拿到的）：provider 已收窄。 */
export type LlmSettingsFormValues = z.output<typeof llmSettingsSchema>;

/** 表单初值：来自已保存的配置；key 永远从空开始（后端只给掩码）。 */
export function toLlmFormValues(
  settings: LlmSettingsRead | undefined,
): LlmSettingsFormInput {
  return {
    provider: settings?.provider ?? "",
    apiKey: "",
    model: settings?.model ?? "",
    auditModel: settings?.auditModel ?? "",
  };
}

/** 这次请求必须带新 key：没存过 key，或服务商与已保存的不同（后端不会把旧 key 发给另一家）。 */
export function needsNewApiKey(
  provider: LlmProviderId,
  settings: LlmSettingsRead | undefined,
): boolean {
  if (!settings?.hasApiKey) return true;

  return provider !== settings.provider;
}

/** apiKey 空串 → 省略（沿用已存的）；auditModel 空串 → null（同对话模型）。 */
export function toSaveLlmSettingsPayload(
  values: LlmSettingsFormValues,
): SaveLlmSettingsPayload {
  return {
    provider: values.provider,
    ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    model: values.model,
    auditModel: values.auditModel || null,
  };
}

export function toListLlmModelsPayload(
  provider: LlmProviderId,
  apiKey: string,
): ListLlmModelsPayload {
  const key = apiKey.trim();

  return { provider, ...(key ? { apiKey: key } : {}) };
}

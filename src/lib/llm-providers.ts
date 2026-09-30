// LLM 服务商（前端 #11）：按题目 C2 只支持 Claude 与 Gemini。后端用各家原生 API（后端 #21），
// 前端只传服务商 id，不再有 Base URL。id 的取值从 api.generated 的 LlmProvider 派生。

import type { components } from "@/types/api.generated";

export type LlmProviderId = components["schemas"]["LlmProvider"];

/** 下拉里的显示名；Record 保证后端的每个服务商都有一项（后端加了新值 tsc 会红）。 */
const LLM_PROVIDER_LABELS: Readonly<Record<LlmProviderId, string>> = {
  anthropic: "Claude（Anthropic）",
  gemini: "Gemini（Google）",
};

/** zod 的 z.enum 要元组；satisfies 保证每一项都是合法的服务商 id。 */
export const LLM_PROVIDER_IDS = [
  "anthropic",
  "gemini",
] as const satisfies readonly LlmProviderId[];

export interface LlmProvider {
  id: LlmProviderId;
  label: string;
}

export const LLM_PROVIDERS: readonly LlmProvider[] = LLM_PROVIDER_IDS.map(
  (id) => ({ id, label: LLM_PROVIDER_LABELS[id] }),
);

export function isLlmProviderId(value: unknown): value is LlmProviderId {
  return LLM_PROVIDER_IDS.some((id) => id === value);
}

/** 当前生效配置卡片用：未知 / 空 → "-"。 */
export function getLlmProviderLabel(id: string | null | undefined): string {
  return LLM_PROVIDERS.find((provider) => provider.id === id)?.label ?? "-";
}

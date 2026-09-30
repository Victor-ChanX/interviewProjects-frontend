// LLM 服务商预设（前端 #9）：选中后把 Base URL 填进表单（仍可改）。都是 OpenAI Chat Completions 兼容端点，
// 后端在 baseUrl 后面拼 /chat/completions、/models。
//
// base URL 只填官方文档里写明的（2026-09-30 核实，出处写在每一项上）；核实不了的留空，选中后让用户自己填。
// 与后端 README 的服务商表同口径。

export interface LlmProvider {
  id: string;
  label: string;
  /** 空串 = 不预填，由用户自己填。 */
  baseUrl: string;
}

export const CUSTOM_PROVIDER_ID = "custom";

export const LLM_PROVIDERS: readonly LlmProvider[] = [
  // https://api-docs.deepseek.com/ —— 「base_url: https://api.deepseek.com」
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com" },
  // https://platform.kimi.ai/docs/api/chat —— 示例 base_url「https://api.moonshot.ai/v1」
  {
    id: "moonshot",
    label: "Kimi（Moonshot）",
    baseUrl: "https://api.moonshot.ai/v1",
  },
  // https://mimo.mi.com/docs/en-US/api/chat/openai-api —— 请求地址
  // 「https://api.xiaomimimo.com/v1/chat/completions」去掉 /chat/completions
  { id: "mimo", label: "小米 MiMo", baseUrl: "https://api.xiaomimimo.com/v1" },
  // https://ai.google.dev/gemini-api/docs/openai —— 「base_url="https://generativelanguage.googleapis.com/v1beta/openai/"」
  {
    id: "gemini",
    label: "Gemini（OpenAI 兼容）",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  { id: CUSTOM_PROVIDER_ID, label: "自定义", baseUrl: "" },
];

/** 与后端 normalizeBaseUrl 同口径：去首尾空白与末尾的 /。比较「是不是同一个地址」都用它。 */
export function normalizeLlmBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getLlmProvider(id: string): LlmProvider | undefined {
  return LLM_PROVIDERS.find((provider) => provider.id === id);
}

/** 已保存的 baseUrl 属于哪个预设（忽略末尾 /）；对不上或为空 → 自定义。 */
export function findLlmProviderId(baseUrl: string | null | undefined): string {
  const target = normalizeLlmBaseUrl(baseUrl ?? "");

  if (!target) return CUSTOM_PROVIDER_ID;

  const match = LLM_PROVIDERS.find(
    (provider) =>
      provider.baseUrl !== "" &&
      normalizeLlmBaseUrl(provider.baseUrl) === target,
  );

  return match?.id ?? CUSTOM_PROVIDER_ID;
}

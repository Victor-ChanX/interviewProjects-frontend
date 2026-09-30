import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { LlmProvider } from "@/lib/llm-providers";
import type {
  LlmSettingsRead,
  LlmTestResult,
} from "@/services/llm-settings-service";

import type { LlmSettingsFormValues } from "./llm-settings-schema";

/** 编辑表单（admin 才有）：预设 → Base URL → API Key → 获取模型列表 → 两个模型下拉 → 保存。 */
export interface LlmSettingsFormViewProps {
  register: UseFormRegister<LlmSettingsFormValues>;
  errors: FieldErrors<LlmSettingsFormValues>;
  providers: readonly LlmProvider[];
  providerId: string;
  onProviderChange: (id: string) => void;
  /** 已存有 key 时是「已保存：sk-…abcd（留空则沿用）」，否则提示填写。 */
  apiKeyPlaceholder: string;
  model: string;
  auditModel: string;
  onModelChange: (value: string) => void;
  onAuditModelChange: (value: string) => void;
  modelOptions: string[];
  modelsFetched: boolean;
  modelsCount: number;
  /** 列表是用另一个 Base URL 拿到的：提示重新获取。 */
  modelsStale: boolean;
  modelsLoading: boolean;
  /** 获取模型列表失败的中文提示（按错误码；key 的问题在 errors.apiKey 里）；null 无。 */
  modelsError: string | null;
  onFetchModels: () => void;
  /** 服务不支持在线配置时整张表单禁用。 */
  disabled: boolean;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** 当前生效配置：canWrite 只决定「尚未配置」时的引导文案。 */
export interface LlmCurrentConfigViewProps {
  settings: LlmSettingsRead;
  canWrite: boolean;
}

/** 测试连接（admin 才有）：用已保存的配置。 */
export interface LlmTestViewProps {
  testing: boolean;
  result: LlmTestResult | null;
  /** 请求本身失败（不是 ok=false）的中文提示。 */
  error: string | null;
  /** 还没有配置 / 服务不支持时禁用，并给出原因。 */
  disabledReason: string | null;
  onTest: () => void;
}

export interface LlmSettingsViewProps {
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  settings: LlmSettingsRead | undefined;
  /** false：顶部 Alert，写操作禁用。 */
  supported: boolean;
  canWrite: boolean;
  /** viewer 为 null：只读展示，不出现输入与按钮。 */
  form: LlmSettingsFormViewProps | null;
  test: LlmTestViewProps | null;
}

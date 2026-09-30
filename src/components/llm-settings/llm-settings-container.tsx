// container：hook 编排 + 权限分支；渲染就绪的数据与回调通过 props 交给 view。
// 业务流（获取模型列表 / 保存 / 测试连接、错误码提示、key 只在表单状态里）都在 use-llm-settings。
// viewer（canWrite=false）不给 form / test，view 只读展示。

import { useCallback, useMemo } from "react";

import { useSession } from "@/hooks/use-session";
import { LLM_PROVIDERS } from "@/lib/llm-providers";

import { LlmSettingsView } from "./llm-settings-view";
import type { LlmSettingsFormViewProps, LlmTestViewProps } from "./types";
import { useLlmSettings } from "./use-llm-settings";

export function LlmSettingsContainer() {
  const canWrite = useSession()?.canWrite ?? false;
  const state = useLlmSettings({ canWrite });
  const { refetch, settings, supported } = state;

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onFetchModels = state.fetchModels;
  const handleFetchModels = useCallback(() => {
    void onFetchModels();
  }, [onFetchModels]);

  // 只有「已存过 key 且服务商没变」才能留空沿用（与后端同口径）。
  const apiKeyPlaceholder =
    settings?.hasApiKey && state.provider === settings.provider
      ? `已保存：${settings.apiKeyHint ?? "…"}（留空则沿用）`
      : "填写服务商的 API Key";

  const form = useMemo<LlmSettingsFormViewProps | null>(
    () =>
      canWrite
        ? {
            register: state.register,
            errors: state.errors,
            providers: LLM_PROVIDERS,
            provider: state.provider,
            onProviderChange: state.changeProvider,
            apiKeyPlaceholder,
            model: state.model,
            auditModel: state.auditModel,
            onModelChange: state.setModel,
            onAuditModelChange: state.setAuditModel,
            modelOptions: state.modelOptions,
            modelsFetched: state.modelsFetched,
            modelsCount: state.modelsCount,
            modelsLoading: state.modelsLoading,
            modelsError: state.modelsError,
            onFetchModels: handleFetchModels,
            disabled: !state.writable,
            saving: state.saving,
            onSubmit: state.submit,
          }
        : null,
    [
      apiKeyPlaceholder,
      canWrite,
      handleFetchModels,
      state.auditModel,
      state.changeProvider,
      state.errors,
      state.model,
      state.modelOptions,
      state.modelsCount,
      state.modelsError,
      state.modelsFetched,
      state.modelsLoading,
      state.provider,
      state.register,
      state.saving,
      state.setAuditModel,
      state.setModel,
      state.submit,
      state.writable,
    ],
  );

  let testDisabledReason: string | null = null;

  if (!supported) testDisabledReason = "当前 Agent 服务不支持在线配置";
  else if (settings?.source === "none")
    testDisabledReason = "尚未配置，保存后才能测试";

  const test: LlmTestViewProps | null = canWrite
    ? {
        testing: state.testing,
        result: state.testResult,
        error: state.testError,
        disabledReason: testDisabledReason,
        onTest: state.runTest,
      }
    : null;

  return (
    <LlmSettingsView
      loading={state.loading}
      error={state.error}
      retrying={state.retrying}
      onRetry={onRetry}
      settings={settings}
      supported={supported}
      canWrite={canWrite}
      form={form}
      test={test}
    />
  );
}

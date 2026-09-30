// LLM 设置表单：纯展示。选预设 → Base URL（可改）→ API Key（password，不回显明文）→ 获取模型列表
// → 对话 / 审核模型两个可搜索下拉 → 保存。RHF 的 register / errors / 回调由 hook 给；校验权威只有 zod，
// 所以 <form noValidate>。

import { Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui-atoms/searchable-select";

import type { LlmSettingsFormViewProps } from "./types";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function FieldHint({ children }: { children: string }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function LlmSettingsFormView({
  register,
  errors,
  providers,
  providerId,
  onProviderChange,
  apiKeyPlaceholder,
  model,
  auditModel,
  onModelChange,
  onAuditModelChange,
  modelOptions,
  modelsFetched,
  modelsCount,
  modelsStale,
  modelsLoading,
  modelsError,
  onFetchModels,
  disabled,
  saving,
  onSubmit,
}: LlmSettingsFormViewProps) {
  const locked = disabled || saving;
  const noOptions = modelOptions.length === 0;

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
      <fieldset className="flex flex-col gap-4" disabled={locked}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-provider">服务商</Label>
          <select
            id="llm-provider"
            className={SELECT_CLASS}
            value={providerId}
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <FieldHint>选中后填入官方文档里的 Base URL，仍可修改</FieldHint>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-base-url">Base URL</Label>
          <Input
            id="llm-base-url"
            placeholder="例如：https://api.example.com/v1"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.baseUrl ? true : undefined}
            {...register("baseUrl")}
          />
          <FieldError message={errors.baseUrl?.message} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llm-api-key">API Key</Label>
          <Input
            id="llm-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={apiKeyPlaceholder}
            aria-invalid={errors.apiKey ? true : undefined}
            {...register("apiKey")}
          />
          <FieldError message={errors.apiKey?.message} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked || modelsLoading}
              onClick={onFetchModels}
            >
              {modelsLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {modelsLoading ? "获取中…" : "获取模型列表"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {modelsFetched
                ? `共 ${modelsCount} 个模型`
                : "先获取模型列表，再选择模型"}
            </span>
          </div>
          {modelsStale ? (
            <p className="text-xs text-muted-foreground">
              Base URL 已修改，这份列表来自之前的地址，请重新获取
            </p>
          ) : null}
          {modelsError ? (
            <Alert variant="destructive">
              <AlertDescription>{modelsError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="llm-model">对话模型</Label>
            <SearchableSelect
              id="llm-model"
              value={model}
              onValueChange={onModelChange}
              options={modelOptions}
              placeholder={noOptions ? "先获取模型列表" : "搜索或选择模型"}
              disabled={locked || noOptions}
              invalid={errors.model !== undefined}
            />
            <FieldError message={errors.model?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="llm-audit-model">
              审核模型（可选，默认同对话模型）
            </Label>
            <SearchableSelect
              id="llm-audit-model"
              value={auditModel}
              onValueChange={onAuditModelChange}
              options={modelOptions}
              placeholder="同对话模型"
              disabled={locked || noOptions}
              clearable
            />
          </div>
        </div>
      </fieldset>

      <Button type="submit" size="sm" className="self-end" disabled={locked}>
        {saving ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}

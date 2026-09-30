// LLM 设置页的布局：纯展示，props 进回调出。不支持在线配置时顶部 Alert → 当前生效配置卡（admin 带测试连接）
// → 编辑表单卡（admin）。viewer 只看到当前配置，不出现任何输入与按钮。不 fetch、不 toast、不做路由。

import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueryError } from "@/components/ui-atoms/query-error";
import { getErrorMessage } from "@/lib/get-error-message";

import { LlmCurrentConfigView } from "./llm-current-config-view";
import { LlmSettingsFormView } from "./llm-settings-form-view";
import { UNSUPPORTED_MESSAGE } from "./llm-settings-schema";
import { LlmTestView } from "./llm-test-view";
import type { LlmSettingsViewProps } from "./types";

export function LlmSettingsView({
  loading,
  error,
  retrying,
  onRetry,
  settings,
  supported,
  canWrite,
  form,
  test,
}: LlmSettingsViewProps) {
  if (error)
    return (
      <QueryError
        title="LLM 配置加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading || !settings)
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-md bg-muted" />
        <div className="h-72 animate-pulse rounded-md bg-muted" />
      </div>
    );

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold">模型设置</h1>
        <p className="text-sm text-muted-foreground">
          LLM Agent 调用的模型服务：Claude 或 Gemini 的 API Key 与模型
        </p>
      </header>

      {!supported ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>不支持在线配置</AlertTitle>
          <AlertDescription>{UNSUPPORTED_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>当前生效配置</CardTitle>
          <CardDescription>
            LLM Agent 每次调用都读取这份配置，保存后立即生效
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LlmCurrentConfigView settings={settings} canWrite={canWrite} />
          {test ? <LlmTestView {...test} /> : null}
        </CardContent>
      </Card>

      {form ? (
        <Card>
          <CardHeader>
            <CardTitle>修改配置</CardTitle>
            <CardDescription>
              选服务商 → 填 API Key → 获取模型列表 → 选模型 → 保存
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LlmSettingsFormView {...form} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          只读账号：只能查看当前配置，不能修改。
        </p>
      )}
    </section>
  );
}

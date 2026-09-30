// 模型设置页的布局：纯展示，props 进回调出。不支持在线配置时顶部 Alert → 两栏：左边当前生效配置（admin 带测试连接），
// 右边修改配置表单（admin）。viewer 只看到当前配置，不出现任何输入与按钮。不 fetch、不 toast、不做路由。

import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-atoms/page-header";
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
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-60" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );

  return (
    <>
      <PageHeader
        title="模型设置"
        description="AI 群助手（LLM Agent）调用的模型服务：Claude 或 Gemini 的 API Key 与对话 / 审核模型，保存后立即生效。"
      />

      {!supported ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>不支持在线配置</AlertTitle>
          <AlertDescription>{UNSUPPORTED_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>当前生效配置</CardTitle>
            <CardDescription>
              LLM Agent 每次调用都读取这份配置；API Key 只显示掩码
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <LlmCurrentConfigView settings={settings} canWrite={canWrite} />
            {test ? (
              <div className="border-t border-border pt-4">
                <LlmTestView {...test} />
              </div>
            ) : null}
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
          <Card>
            <CardHeader>
              <CardTitle>修改配置</CardTitle>
              <CardDescription>
                只读账号：只能查看当前配置，不能修改。
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </>
  );
}

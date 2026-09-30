// 测试连接：纯展示。按钮 + 结果（ok / 延迟 / 模型 / 消息）；请求本身失败时显示按错误码翻好的提示。

import { Loader2, PlugZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { LlmTestViewProps } from "./types";

export function LlmTestView({
  testing,
  result,
  error,
  disabledReason,
  onTest,
}: LlmTestViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing || disabledReason !== null}
          onClick={onTest}
        >
          {testing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PlugZap className="size-4" />
          )}
          {testing ? "测试中…" : "测试连接"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {disabledReason ?? "用已保存的配置发一次最小请求"}
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result && !error ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">结果</dt>
          <dd
            className={cn("font-medium", {
              "text-success": result.ok,
              "text-destructive": !result.ok,
            })}
          >
            {result.ok ? "连接正常" : "连接失败"}
          </dd>
          <dt className="text-muted-foreground">延迟</dt>
          <dd className="tabular-nums">{result.latencyMs} ms</dd>
          <dt className="text-muted-foreground">模型</dt>
          <dd className="font-mono text-xs leading-5 break-all">
            {result.model ?? "-"}
          </dd>
          <dt className="text-muted-foreground">消息</dt>
          <dd className="break-all">{result.message || "-"}</dd>
        </dl>
      ) : null}
    </div>
  );
}

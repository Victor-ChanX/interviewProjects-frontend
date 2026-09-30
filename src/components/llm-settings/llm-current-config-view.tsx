// 当前生效的 LLM 配置：纯展示。来源、服务商、两个模型、key 掩码、更新时间；还没配置过时给出引导。
// key 只有后端给的掩码（apiKeyHint），这里从来拿不到明文。
// source 为 null = Agent 服务不支持在线配置、读不到配置（原因在页面顶部的 Alert 里）。

import { formatDateTime } from "@/lib/format-date";
import { getLlmProviderLabel } from "@/lib/llm-providers";
import type { LlmSettingsSource } from "@/services/llm-settings-service";

import type { LlmCurrentConfigViewProps } from "./types";

const SOURCE_LABELS: Readonly<Record<LlmSettingsSource, string>> = {
  file: "控制台保存",
  none: "尚未配置",
};

export function LlmCurrentConfigView({
  settings,
  canWrite,
}: LlmCurrentConfigViewProps) {
  if (settings.source === null)
    return (
      <p className="text-sm text-muted-foreground">
        读取不到配置：当前 Agent 服务不支持在线配置。
      </p>
    );

  if (settings.source === "none")
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">尚未配置</p>
        <p className="text-muted-foreground">
          {canWrite
            ? "在下方选择服务商（Claude 或 Gemini）、填写 API Key，获取模型列表并选好模型后保存。"
            : "还没有配置 LLM，请联系管理员在本页完成配置。"}
        </p>
      </div>
    );

  const rows: [string, string][] = [
    ["来源", SOURCE_LABELS[settings.source]],
    ["服务商", getLlmProviderLabel(settings.provider)],
    ["对话模型", settings.model ?? "-"],
    ["审核模型", settings.auditModel ?? "同对话模型"],
    [
      "API Key",
      settings.hasApiKey ? (settings.apiKeyHint ?? "已保存") : "未保存",
    ],
    ["更新时间", formatDateTime(settings.updatedAt)],
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 font-mono text-xs leading-5 break-all">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

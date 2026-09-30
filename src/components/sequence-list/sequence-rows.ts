// 定时序列列表的行：序列定义 → 渲染就绪的一行（步数、占位符、累计延迟）。纯函数，单 feature 留本地。

import { collectPlaceholders } from "@/lib/sequence-vars";
import type { SequenceRead } from "@/services/sequence-service";

import type { SequenceRow } from "./types";

export function toSequenceRow(sequence: SequenceRead): SequenceRow {
  return {
    id: sequence.id,
    name: sequence.name,
    stepCount: sequence.steps.length,
    placeholders: collectPlaceholders(sequence.steps),
    totalDelaySeconds: sequence.steps.reduce(
      (sum, step) => sum + step.delaySeconds,
      0,
    ),
    createdAt: sequence.createdAt,
    sequence,
  };
}

/** 「1 分 30 秒」这样的延迟文案。 */
export function formatDelay(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return rest === 0 ? `${minutes} 分` : `${minutes} 分 ${rest} 秒`;
}

// 状态徽标：圆点 + 文案，颜色按语气（src/lib/status-tone.ts）取，所有页面同一种状态长得一样。
// 业务状态 → 语气的映射在 src/lib/*-labels.ts。

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  STATUS_TONE_CLASS,
  STATUS_TONE_DOT_CLASS,
  type StatusTone,
} from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  /** 进行中的状态让圆点呼吸。 */
  pulse?: boolean;
  /** 圆点：默认有；表格里一列全是徽标时可以去掉。 */
  dot?: boolean;
  className?: string;
  title?: string;
  "data-testid"?: string;
}

export function StatusBadge({
  tone,
  children,
  pulse = false,
  dot = true,
  className,
  title,
  "data-testid": testId,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      title={title}
      data-testid={testId}
      className={cn("gap-1.5 font-medium", STATUS_TONE_CLASS[tone], className)}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            STATUS_TONE_DOT_CLASS[tone],
            { "animate-pulse": pulse },
          )}
        />
      ) : null}
      {children}
    </Badge>
  );
}

// 状态徽标的「语气」→ 样式类（全部走主题 token：success / warning / destructive / primary / muted）。
// 各业务状态先映射成语气（src/lib/*-labels.ts），徽标原子（src/components/ui-atoms/status-badge.tsx）再按语气取类，
// 同一种语气在所有页面长得一样。

export type StatusTone =
  "success" | "warning" | "danger" | "info" | "neutral" | "muted";

export const STATUS_TONES: readonly StatusTone[] = Object.freeze([
  "success",
  "warning",
  "danger",
  "info",
  "neutral",
  "muted",
]);

/** 徽标本体：淡底 + 同色字 + 同色细边。 */
export const STATUS_TONE_CLASS: Readonly<Record<StatusTone, string>> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-primary/25 bg-primary/10 text-primary",
  neutral: "border-border bg-muted text-foreground/80",
  muted: "border-border bg-transparent text-muted-foreground",
};

/** 徽标前的小圆点。 */
export const STATUS_TONE_DOT_CLASS: Readonly<Record<StatusTone, string>> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
  neutral: "bg-foreground/50",
  muted: "bg-muted-foreground/60",
};

/** 纯文字（数字、说明）用的前景色。 */
export const STATUS_TONE_TEXT_CLASS: Readonly<Record<StatusTone, string>> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-primary",
  neutral: "text-foreground",
  muted: "text-muted-foreground",
};

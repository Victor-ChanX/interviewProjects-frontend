// 日期展示：后端下发 ISO 时刻，前端按业务时区（东八区）展示成 YYYY-MM-DD HH:mm。
// 「今天 / 本月」这类判断也走 Intl + timeZone，不用 toISOString().slice(0, 10)。

const BUSINESS_TIME_ZONE = "Asia/Shanghai";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "-";

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "-";

  // en-CA 给出 "2026-09-30, 08:30"，把逗号换成空格。
  return DATE_TIME_FORMAT.format(date).replace(",", "");
}

/** 业务时区的自然日（YYYY-MM-DD）。 */
export function businessDate(date: Date = new Date()): string {
  return DATE_FORMAT.format(date);
}

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "always",
});

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/**
 * 相对时间（「3 分钟后」「2 小时前」），给 rateLimitedUntil 这类到期时刻用。
 * `now` 由调用方传入：渲染期不反复 new Date()，测试也不依赖真实时钟。
 * 不足 1 分钟按「1 分钟后 / 1 分钟前」；无值或非法为 "-"。
 */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  now: number,
): string {
  if (!value) return "-";

  const target = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(target.getTime())) return "-";

  const delta = target.getTime() - now;
  const sign = delta < 0 ? -1 : 1;
  const abs = Math.abs(delta);

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms)
      return RELATIVE_FORMAT.format(sign * Math.round(abs / ms), unit);
  }

  return RELATIVE_FORMAT.format(sign, "minute");
}

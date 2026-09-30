// 日期展示：后端下发 ISO 时刻（UTC），前端按**查看者（浏览器）所在时区**展示成 YYYY-MM-DD HH:mm（前端 #20）。
// 「今天」这类判断也走 Intl + timeZone，不用 toISOString().slice(0, 10)（那是 UTC 日）。
// 工作台的「今日」计数由后端按同一个时区切（viewerTimeZone() 作为 timeZone 参数传给 /api/dashboard/summary）。
// timeZone 参数只给测试钉时区用；业务代码不传，用浏览器时区。

/** 浏览器所在时区（IANA 名，如 Asia/Shanghai）；运行时给不出来时按 UTC。 */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cachedFormat(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let format = cache.get(timeZone);

  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", { ...options, timeZone });
    cache.set(timeZone, format);
  }

  return format;
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string = viewerTimeZone(),
): string {
  if (!value) return "-";

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) return "-";

  const format = cachedFormat(dateTimeFormats, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // en-CA 给出 "2026-09-30, 08:30"，把逗号换成空格。
  return format.format(date).replace(",", "");
}

/** 查看者时区的自然日（YYYY-MM-DD）。 */
export function localDate(
  date: Date = new Date(),
  timeZone: string = viewerTimeZone(),
): string {
  return cachedFormat(dateFormats, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

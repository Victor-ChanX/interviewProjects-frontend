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

// 步骤入参（AgentStepRead.input，后端是自由 record）的两种展示：表格里一行摘要、展开后的多行 JSON。
// 纯函数，单 feature 先留本地（frontend-unit-testing test.extract-then-test）。

/** 表格单元格里的摘要：紧凑 JSON 截到 max 个字符，超出补省略号；null（协议错误步）给 "-"。 */
export function summarizeJson(value: unknown, max = 80): string {
  if (value === null || value === undefined) return "-";

  const compact = JSON.stringify(value);

  if (compact === undefined) return "-";

  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

/** 展开后的完整 JSON（两空格缩进）；null 给 "-"。 */
export function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "-";

  return JSON.stringify(value, null, 2) ?? "-";
}

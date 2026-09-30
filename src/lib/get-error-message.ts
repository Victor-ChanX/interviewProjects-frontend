// 错误文案的唯一出口（frontend-api-function-calls「Error Handling」api.get-error-message）。
// 断网 / 超时翻中文、非 Error 值兜底；业务代码不手写 `as Error` / `instanceof Error`。

export function getErrorMessage(error: unknown, fallback = "操作失败"): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "请求超时，请重试";

    if (error.name === "TypeError" && /fetch/i.test(error.message))
      return "网络连接失败，请检查网络";

    return error.message || fallback;
  }

  if (typeof error === "string" && error) return error;

  return fallback;
}

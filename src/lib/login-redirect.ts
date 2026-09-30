// 登录页跳转的两半：未登录 → `/login?next=<当前页>`；登录成功 → 回 next。
// next 只认站内相对路径（frontend-api-function-calls「Request Layer」：防开放重定向）。

export const LOGIN_PATH = "/login";

/** 登录后没有 next（或 next 不合法）时的落点：首页本身也重定向到这里（src/app/router.tsx）。 */
export const DEFAULT_AFTER_LOGIN = "/accounts";

/**
 * 把 URL 里的 next 收窄成站内路径：必须以单个 `/` 开头（`//evil.com` 是协议相对地址，不认），
 * 不能是登录页自己（否则登录完又回登录页）。不合法一律回 DEFAULT_AFTER_LOGIN。
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\"))
    return DEFAULT_AFTER_LOGIN;

  if (raw === LOGIN_PATH || raw.startsWith(`${LOGIN_PATH}?`))
    return DEFAULT_AFTER_LOGIN;

  return raw;
}

/**
 * 由当前页（pathname + search）造登录页地址。首页、默认落点与不合法的地址不值得记 next
 * （登录完本来就去 DEFAULT_AFTER_LOGIN），直接 `/login`。
 */
export function buildLoginRedirect(current: string): string {
  const next = safeNextPath(current);

  if (next === DEFAULT_AFTER_LOGIN || current === "/") return LOGIN_PATH;

  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

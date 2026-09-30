// 账号管理当前的筛选页签，存在 URL 里（nuqs：`?status=online`），刷新 / 分享链接都保留。

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ACCOUNT_TABS } from "./account-filters";

export function useAccountTab() {
  return useQueryState(
    "status",
    parseAsStringLiteral(ACCOUNT_TABS).withDefault("all"),
  );
}

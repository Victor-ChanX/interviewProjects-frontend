// 群详情当前页签（nuqs：`?tab=`，默认「消息」）。

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { GROUP_TABS } from "./group-tabs";

export function useGroupTab() {
  return useQueryState(
    "tab",
    parseAsStringLiteral(GROUP_TABS).withDefault("messages"),
  );
}

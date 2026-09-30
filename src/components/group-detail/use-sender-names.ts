// 时间线发送人的显示名：GET /api/accounts（与发消息表单同一个缓存键）建「平台用户 ID → 账号 ID」表。
// 账号的平台用户 ID 只在连接时分配、之后不变，所以不订阅实时事件；拉不到时退回显示平台用户 ID。

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildSenderNames } from "@/lib/message-labels";
import { queryKeys } from "@/lib/query-keys";
import { listAccounts } from "@/services/account-service";

export function useSenderNames(): ReadonlyMap<string, string> {
  const { data } = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: listAccounts,
  });

  return useMemo(() => buildSenderNames(data ?? []), [data]);
}

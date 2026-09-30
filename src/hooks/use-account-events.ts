// 账号域的实时事件 → TanStack Query 缓存（frontend-realtime-events；前端 #3）。
// 事件进缓存的唯一途径是 queryClient.setQueryData / invalidateQueries，key 取自 @/lib/query-keys；
// container 调它，view 不知道有连接存在。订阅走 use-realtime 的 useRealtimeEvent，卸载只退订。
//
// 后端推的是 { accountId, from, to } / { accountId, status }，不是整行实体（题目 2.3 WS type 列表），
// 所以先把缓存里那一行的 status 就地改掉（页面立刻变），再 invalidate 让 REST 拿回权威的
// platformUserId / rateLimitedUntil；缓存里没有列表（old === undefined）时不造，只 invalidate。

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import type { AccountRead, AccountStatus } from "@/services/account-service";

// 事件负载后端没进 openapi（WS 端点 schema.hide），按后端 src/services/account-service.ts 写事件处的形状手写。
export interface AccountStatusChangedPayload {
  accountId: string;
  from: AccountStatus;
  to: AccountStatus;
}

export interface AccountTerminalPayload {
  accountId: string;
  status: AccountStatus;
}

/** 就地改一行的 status；离开 rate_limited 时顺手清掉 rateLimitedUntil（权威值随后由 REST 覆盖）。 */
export function applyAccountStatus(
  list: AccountRead[] | undefined,
  accountId: string,
  status: AccountStatus,
): AccountRead[] | undefined {
  if (!list) return list;

  return list.map((row) =>
    row.id === accountId
      ? {
          ...row,
          status,
          rateLimitedUntil:
            status === "rate_limited" ? row.rateLimitedUntil : null,
        }
      : row,
  );
}

export function useAccountEvents(): void {
  const queryClient = useQueryClient();

  const apply = useCallback(
    (accountId: string, status: AccountStatus) => {
      queryClient.setQueryData<AccountRead[]>(
        queryKeys.accounts.list(),
        (prev) => applyAccountStatus(prev, accountId, status),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    [queryClient],
  );

  const onStatusChanged = useCallback(
    (payload: AccountStatusChangedPayload) =>
      apply(payload.accountId, payload.to),
    [apply],
  );
  const onTerminal = useCallback(
    (payload: AccountTerminalPayload) =>
      apply(payload.accountId, payload.status),
    [apply],
  );

  useRealtimeEvent<AccountStatusChangedPayload>(
    "account_status_changed",
    onStatusChanged,
  );
  useRealtimeEvent<AccountTerminalPayload>("account_terminal", onTerminal);
}

// feature hook：useQuery / useMutation 只在这里调；按转移表 + canWrite 把每行算成渲染就绪的 AccountRow，
// 操作（标记离线 / 重连 / 释放账号）的成功、409 CAS_CONFLICT / ILLEGAL_TRANSITION、网关错误也在这里分支。

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-session";
import {
  ACCOUNT_ACTION_TARGET,
  availableActions,
  isTerminalStatus,
  type AccountAction,
} from "@/lib/account-transitions";
import { formatRelativeTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import {
  accountErrorCode,
  connectAccount,
  listAccounts,
  transitionAccount,
  type AccountRead,
  type AccountStatus,
} from "@/services/account-service";

import { ACCOUNT_ACTION_LABELS, type AccountRow } from "./types";

/** rateLimitedUntil 倒计时的刷新间隔：只在有 rate_limited 行时走。 */
const NOW_TICK_MS = 10_000;

interface ActionInput {
  id: string;
  action: AccountAction;
  /** 当前显示的状态：作为 CAS 的 expectedFrom 发给后端。 */
  expectedFrom: AccountStatus;
}

function runAction({ id, action, expectedFrom }: ActionInput) {
  return action === "reconnect"
    ? connectAccount(id)
    : transitionAccount(id, {
        to: ACCOUNT_ACTION_TARGET[action],
        expectedFrom,
      });
}

function toAccountRow(
  account: AccountRead,
  canWrite: boolean,
  now: number,
): AccountRow {
  return {
    id: account.id,
    status: account.status,
    platformUserId: account.platformUserId,
    rateLimitedUntil: account.rateLimitedUntil,
    rateLimitedUntilLabel:
      account.status === "rate_limited"
        ? formatRelativeTime(account.rateLimitedUntil, now)
        : null,
    terminal: isTerminalStatus(account.status),
    // viewer 一律不渲染按钮（直接调接口也是 403）。
    actions: canWrite ? availableActions(account.status) : [],
  };
}

export function useAccountList() {
  // 未登录（null）与 viewer 一样不渲染写操作；页面本身由受保护布局兜底跳登录。
  const canWrite = useSession()?.canWrite ?? false;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: listAccounts,
  });

  const accounts = query.data;
  const hasRateLimited = useMemo(
    () =>
      accounts?.some((account) => account.status === "rate_limited") ?? false,
    [accounts],
  );
  const [now, setNow] = useState(() => Date.now());

  // 倒计时只在有限流行时才走；到期后的 rate_limited → online 由后端事件推过来。
  useEffect(() => {
    if (!hasRateLimited) return;

    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);

    return () => clearInterval(timer);
  }, [hasRateLimited]);

  const rows = useMemo(
    () =>
      (accounts ?? []).map((account) => toAccountRow(account, canWrite, now)),
    [accounts, canWrite, now],
  );

  const mutation = useMutation({ mutationFn: runAction });
  const { mutateAsync } = mutation;
  const { refetch } = query;

  const onAction = useCallback(
    async (id: string, action: AccountAction) => {
      const current = queryClient
        .getQueryData<AccountRead[]>(queryKeys.accounts.list())
        ?.find((account) => account.id === id);

      if (!current) return;

      const label = ACCOUNT_ACTION_LABELS[action];

      try {
        const result = await mutateAsync({
          id,
          action,
          expectedFrom: current.status,
        });

        queryClient.setQueryData<AccountRead[]>(
          queryKeys.accounts.list(),
          (prev) =>
            prev?.map((account) =>
              account.id === id
                ? {
                    ...account,
                    status: result.status,
                    platformUserId: result.platformUserId,
                    rateLimitedUntil: result.rateLimitedUntil,
                  }
                : account,
            ),
        );
        toast.success(`已${label}：${id}`);
      } catch (error) {
        const code = accountErrorCode(error);

        if (code === "CAS_CONFLICT" || code === "ILLEGAL_TRANSITION") {
          // 当前显示的状态已经过期（别人先改了 / 到期自动回了）：提示并重拉，按钮随新状态重算。
          toast.warning("状态已变化，列表已刷新");
          void refetch();

          return;
        }

        toast.error(getErrorMessage(error, `${label}失败`));

        // 账号在操作途中进了终态（网关拒绝）：重拉让终态醒目显示。
        if (code === "ACCOUNT_UNAVAILABLE") void refetch();
      }
    },
    [mutateAsync, queryClient, refetch],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    rows,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
    onAction,
    onRetry,
  };
}

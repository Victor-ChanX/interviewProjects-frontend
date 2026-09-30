// container：异常中心的编排 —— 列表 / 页签 / 抽屉详情 / 标记已处理（admin；成功与失败的 toast 在这里）。

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/get-error-message";

import { InconsistencyCenterView } from "./inconsistency-center-view";
import { useInconsistencies } from "./use-inconsistencies";

export function InconsistencyCenterContainer() {
  const canResolve = useSession()?.canWrite ?? false;
  const state = useInconsistencies();
  const { summary } = useDashboardSummary();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { resolve, refetch, loadMore } = state;

  const onResolve = useCallback(
    async (id: string) => {
      setResolvingId(id);

      try {
        const row = await resolve(id);

        toast.success(`已标记为已处理（处理人 ${row.resolvedBy ?? "-"}）`);
      } catch (error) {
        toast.error(getErrorMessage(error, "标记失败，请重试"));
      } finally {
        setResolvingId(null);
      }
    },
    [resolve],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const handleResolve = useCallback(
    (id: string) => {
      void onResolve(id);
    },
    [onResolve],
  );

  return (
    <InconsistencyCenterView
      tab={state.tab}
      onTabChange={state.changeTab}
      unresolvedCount={summary?.inconsistencies.unresolved}
      items={state.items}
      loading={state.loading}
      error={state.error}
      retrying={state.retrying}
      onRetry={onRetry}
      hasMore={state.hasMore}
      loadingMore={state.loadingMore}
      onLoadMore={onLoadMore}
      onOpen={state.openDetail}
      canResolve={canResolve}
      onResolve={handleResolve}
      resolvingId={resolvingId}
      sheet={{
        open: state.detailOpen,
        onOpenChange: state.setDetailOpen,
        detail: state.detail,
        loading: state.detailLoading,
        errorMessage: state.detailError
          ? getErrorMessage(state.detailError, "详情加载失败")
          : null,
        canResolve,
        resolving: state.resolving,
        onResolve: handleResolve,
      }}
    />
  );
}

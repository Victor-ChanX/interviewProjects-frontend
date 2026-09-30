// 应用级 QueryClient 单例：providers.tsx 挂它，ws 事件回写缓存也只经它
// （setQueryData / invalidateQueries）。query 的默认错误出口（toast）也在这里配。

import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

declare module "@tanstack/react-query" {
  interface Register {
    // 必须是 type 不能是 interface：interface 没有索引签名会静默退回 Record<string, unknown>。
    queryMeta: { errorMessage?: string; silent?: boolean };
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) return;

      toast.error(
        getErrorMessage(error, query.meta?.errorMessage ?? "加载失败"),
      );
    },
  }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

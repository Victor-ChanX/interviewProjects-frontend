// 查询错误卡（frontend-api-function-calls「Error Handling」）：主数据块加载失败时在骨架屏之前渲染，
// toast 几秒就没，空表分不清「没数据」和「坏了」。hook 暴露 error / refetch / isFetching →
// 容器透传 error / onRetry / retrying → view 渲染这张卡。文案由调用方从 getErrorMessage 派生后传入。

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QueryErrorProps {
  title: string;
  /** 整句错误文案（调用方用 getErrorMessage 派生）；不传只显示标题。 */
  message?: string | null;
  retrying?: boolean;
  onRetry: () => void;
  className?: string;
}

export function QueryError({
  title,
  message,
  retrying = false,
  onRetry,
  className,
}: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-destructive/40 p-4 text-sm",
        className,
      )}
    >
      <p className="font-medium text-destructive">{title}</p>
      {message ? <p className="text-muted-foreground">{message}</p> : null}
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={cn("size-4", { "animate-spin": retrying })} />
        重试
      </Button>
    </div>
  );
}

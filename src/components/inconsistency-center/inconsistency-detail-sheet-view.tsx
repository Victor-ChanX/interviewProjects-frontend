// 异常详情抽屉：类型 / 引用 / 说明 / 时间 / 处理人 + payload 原文（JSON 格式化）；admin 底部「标记已处理」。
// 三段式：header 与 footer 固定，只有中间的 SheetBody 滚（frontend-overlay-layout）。

import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SheetBody } from "@/components/ui-atoms/dialog-shell";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { describeInconsistencyKind } from "@/lib/inconsistency-labels";

import type { InconsistencyDetailSheetViewProps } from "./types";

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "（无 payload）";

  return JSON.stringify(payload, null, 2) ?? "（无 payload）";
}

export function InconsistencyDetailSheetView({
  open,
  onOpenChange,
  detail,
  loading,
  errorMessage,
  canResolve,
  resolving,
  onResolve,
}: InconsistencyDetailSheetViewProps) {
  const resolved = Boolean(detail?.resolvedAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            {detail ? describeInconsistencyKind(detail.kind) : "异常详情"}
            {detail ? (
              <StatusBadge tone={resolved ? "success" : "danger"}>
                {resolved ? "已处理" : "未处理"}
              </StatusBadge>
            ) : null}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {detail?.kind ?? " "}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-4">
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : loading || !detail ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">说明</dt>
                <dd className="break-words">{detail.message}</dd>
                <dt className="text-muted-foreground">引用</dt>
                <dd className="font-mono text-xs break-all">
                  {detail.ref ?? "-"}
                </dd>
                <dt className="text-muted-foreground">发生时间</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
                <dt className="text-muted-foreground">处理</dt>
                <dd>
                  {detail.resolvedAt
                    ? `${detail.resolvedBy ?? "-"} · ${formatDateTime(detail.resolvedAt)}`
                    : "未处理"}
                </dd>
              </dl>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  payload（原文）
                </span>
                <pre
                  className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all"
                  data-testid="inconsistency-payload"
                >
                  {formatPayload(detail.payload)}
                </pre>
              </div>
            </>
          )}
        </SheetBody>

        {canResolve && detail && !resolved ? (
          <SheetFooter className="border-t border-border">
            <Button disabled={resolving} onClick={() => onResolve(detail.id)}>
              <CheckCheck />
              {resolving ? "提交中…" : "标记已处理"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

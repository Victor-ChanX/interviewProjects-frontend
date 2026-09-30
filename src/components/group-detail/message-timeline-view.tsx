// 消息时间线：纯展示。props 里的 messages 是 sentAt 倒序（后端与缓存的顺序）；这里反过来渲染，最新在下
// （聊天习惯），「加载更早」在最上面。滚动容器用 flex-col-reverse：初始就停在底部、新消息进来不跳，
// 加载更早的页接在顶部也不把视口推走 —— 不需要任何 effect 去算滚动位置。
// 自己的消息靠右（主色气泡）并带投递状态；别人的靠左。不知道有实时连接这回事，新消息进来只是 props 变了。
// 滚动容器是 role="log" + aria-live="polite"：读屏在用户空闲时播报新进来的消息（前端 #14）。

import { MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui-atoms/query-error";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
  senderDisplay,
  shouldShowFailCode,
} from "@/lib/message-labels";
import { cn } from "@/lib/utils";
import { messageKey, type MessageRead } from "@/services/message-service";

import type { MessageTimelineViewProps } from "./types";

function DeliveryBadge({ message }: { message: MessageRead }) {
  const status = message.deliveryStatus;

  if (!status) return null;

  return (
    <StatusBadge
      tone={DELIVERY_STATUS_TONE[status]}
      pulse={
        status === "queued" || status === "accepted" || status === "unknown"
      }
      title={message.failCode ?? undefined}
      className="h-4.5 px-1.5 text-[11px]"
    >
      {DELIVERY_STATUS_LABELS[status]}
      {shouldShowFailCode(status, message.failCode)
        ? ` ${message.failCode}`
        : null}
    </StatusBadge>
  );
}

function MessageRow({
  message,
  senderNames,
}: {
  message: MessageRead;
  senderNames: ReadonlyMap<string, string>;
}) {
  const own = message.isOwn;
  const sender = senderDisplay(message.senderPlatformUserId, senderNames);

  return (
    <li className={cn("flex gap-2.5", own ? "flex-row-reverse" : "flex-row")}>
      <span
        aria-hidden
        className={cn(
          "mt-5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          own ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {sender.initials}
      </span>
      <div
        className={cn("flex max-w-[78%] min-w-0 flex-col gap-1", {
          "items-end": own,
          "items-start": !own,
        })}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono" title={message.senderPlatformUserId}>
            {sender.name}
          </span>
          <time dateTime={message.sentAt}>
            {formatDateTime(message.sentAt)}
          </time>
          {own ? <DeliveryBadge message={message} /> : null}
        </div>
        <p
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs",
            own
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card text-foreground ring-1 ring-border",
            { "opacity-60": message.deliveryStatus === "cancelled" },
          )}
        >
          {message.text}
        </p>
      </div>
    </li>
  );
}

export function MessageTimelineView({
  messages,
  senderNames,
  loading,
  error,
  retrying,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
}: MessageTimelineViewProps) {
  if (error)
    return (
      <div className="p-4">
        <QueryError
          title="消息加载失败"
          message={getErrorMessage(error)}
          retrying={retrying}
          onRetry={onRetry}
        />
      </div>
    );

  if (loading)
    return (
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={i}
            className={cn("h-12 w-2/3 rounded-2xl", {
              "self-end": i % 2 === 1,
            })}
          />
        ))}
      </div>
    );

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="群消息"
      className="flex h-[min(60dvh,36rem)] flex-col-reverse overflow-y-auto bg-muted/20"
      data-testid="message-timeline"
    >
      <div className="flex flex-col gap-4 p-4">
        {hasMore ? (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中…" : "加载更早"}
          </Button>
        ) : messages.length > 0 ? (
          <p className="self-center text-xs text-muted-foreground">
            没有更早的消息了
          </p>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <MessagesSquare className="size-8 opacity-50" />
            <p className="text-sm">暂无消息</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {/* 倒序 → 正序：最旧在上、最新在下。 */}
            {[...messages].reverse().map((message) => (
              <MessageRow
                key={messageKey(message)}
                message={message}
                senderNames={senderNames}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// 消息时间线：纯展示。props 里的 messages 是 sentAt 倒序（后端与缓存的顺序）；这里**反过来渲染，
// 最新在下**（聊天习惯：往下读是往后），「加载更早」按钮在最上面，加载出的旧页接在顶部。
// 自己的消息靠右并带投递状态徽标；别人的靠左。不知道有实时连接这回事，新消息进来只是 props 变了。

import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/ui-atoms/query-error";
import { formatDateTime } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import {
  type DeliveryStatus,
  messageKey,
  type MessageRead,
} from "@/services/message-service";

import type { MessageTimelineViewProps } from "./types";

const DELIVERY_LABELS: Readonly<Record<DeliveryStatus, string>> = {
  queued: "排队中",
  accepted: "已受理",
  sent: "已发送",
  failed: "发送失败",
  unknown: "状态未知",
  cancelled: "已取消",
};

/** 投递状态 → 徽标样式，六种各一种，全部走主题 token（success / warning / destructive / muted）。 */
const DELIVERY_CLASS: Readonly<Record<DeliveryStatus, string>> = {
  queued: "border-border bg-muted text-muted-foreground",
  accepted: "border-warning/40 bg-warning/15 text-warning",
  sent: "border-success/40 bg-success/15 text-success",
  failed: "border-destructive/40 bg-destructive/15 text-destructive",
  unknown: "border-warning/40 bg-background text-warning",
  cancelled: "border-border bg-background text-muted-foreground line-through",
};

function DeliveryBadge({ message }: { message: MessageRead }) {
  const status = message.deliveryStatus;

  if (!status) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium",
        DELIVERY_CLASS[status],
      )}
      title={message.failCode ?? undefined}
    >
      {DELIVERY_LABELS[status]}
      {status === "failed" && message.failCode
        ? `（${message.failCode}）`
        : null}
    </span>
  );
}

function MessageRow({ message }: { message: MessageRead }) {
  return (
    <li
      className={cn("flex flex-col gap-1", {
        "items-end": message.isOwn,
        "items-start": !message.isOwn,
      })}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{message.senderPlatformUserId}</span>
        <time dateTime={message.sentAt}>{formatDateTime(message.sentAt)}</time>
        {message.isOwn ? <DeliveryBadge message={message} /> : null}
      </div>
      <p
        className={cn(
          "max-w-[80%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words",
          message.isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          { "opacity-60": message.deliveryStatus === "cancelled" },
        )}
      >
        {message.text}
      </p>
    </li>
  );
}

export function MessageTimelineView({
  messages,
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
      <QueryError
        title="消息加载失败"
        message={getErrorMessage(error)}
        retrying={retrying}
        onRetry={onRetry}
      />
    );

  if (loading)
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;

  return (
    <div className="flex flex-col gap-3">
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
        <p className="text-sm text-muted-foreground">暂无消息</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {/* 倒序 → 正序：最旧在上、最新在下。 */}
          {[...messages].reverse().map((message) => (
            <MessageRow key={messageKey(message)} message={message} />
          ))}
        </ol>
      )}
    </div>
  );
}

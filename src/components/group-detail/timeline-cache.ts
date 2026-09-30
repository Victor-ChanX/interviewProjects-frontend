// 时间线缓存的纯函数（游标分页 + 实时追加并存，frontend-realtime-events「列表」）。
// 缓存形状是 useInfiniteQuery 的 InfiniteData<MessagePage>：pages[0] 是最新页，每页 items 按 sentAt 倒序。
// 规则：新项只进 pages[0] 头部（按 sentAt 倒序找位置），pageParams 与旧页一律不动 —— 游标是「比某项更早」，
// 后来的新项不影响旧游标；更新按 key 在每一页就地替换；全程按 messageKey 去重。
// 这里不碰 React / queryClient，由 use-message-timeline.ts 用 setQueryData 的函数式更新套上。

import type { InfiniteData } from "@tanstack/react-query";

import type { MessageEventPayload } from "@/lib/ws";
import {
  messageKey,
  type MessagePage,
  type MessageRead,
} from "@/services/message-service";

// pageParams 这里从不读写，所以不收窄游标类型（与 useInfiniteQuery 推断出的 unknown 兼容）。
export type TimelineData = InfiniteData<MessagePage>;

/** 按 sentAt 倒序插入（同时刻放前面：后到的更「新」），返回新数组。 */
function insertByTime(
  items: MessageRead[],
  message: MessageRead,
): MessageRead[] {
  const at = items.findIndex((item) => item.sentAt <= message.sentAt);

  if (at === -1) return [...items, message];

  return [...items.slice(0, at), message, ...items.slice(at)];
}

function replacePage(
  data: TimelineData,
  index: number,
  items: MessageRead[],
): TimelineData {
  const page = data.pages[index];

  if (!page) return data;

  return {
    ...data,
    pages: data.pages.map((p, i) => (i === index ? { ...page, items } : p)),
  };
}

export function hasMessage(data: TimelineData, key: string): boolean {
  return data.pages.some((page) =>
    page.items.some((item) => messageKey(item) === key),
  );
}

/**
 * `message` 事件带 clientMsgId 时，把投递状态（与发出后才有的 msgId）就地写进已有的行。
 * 缓存里没有这一行返回 null，调用方改走「刷新最新页」。
 */
export function applyDeliveryUpdate(
  data: TimelineData,
  payload: MessageEventPayload,
): TimelineData | null {
  const key = payload.clientMsgId;

  if (!key || !hasMessage(data, key)) return null;

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        messageKey(item) === key
          ? {
              ...item,
              msgId: payload.msgId ?? item.msgId,
              deliveryStatus:
                payload.deliveryStatus === undefined
                  ? item.deliveryStatus
                  : payload.deliveryStatus,
              failCode:
                payload.failCode === undefined
                  ? item.failCode
                  : payload.failCode,
            }
          : item,
      ),
    })),
  };
}

/**
 * 把重新拉回的最新页并进缓存：已有的行（任一页）整行替换成新数据；没见过的行插到 pages[0]
 * 按 sentAt 倒序的位置。不重不漏，旧页与游标不动。
 */
export function mergeHeadPage(
  data: TimelineData,
  fresh: MessageRead[],
): TimelineData {
  const byKey = new Map(fresh.map((item) => [messageKey(item), item]));
  let next: TimelineData = {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => byKey.get(messageKey(item)) ?? item),
    })),
  };
  const head = next.pages[0];

  if (!head) return next;

  let items = head.items;

  // fresh 本身是倒序的，从最旧的开始插，保证同时刻的相对顺序与后端一致。
  for (const item of [...fresh].reverse()) {
    if (hasMessage(next, messageKey(item))) continue;

    items = insertByTime(items, item);
    next = replacePage(next, 0, items);
  }

  return next;
}

/** 发送成功（202）后乐观插入一条自己的 queued 消息；同 key 已在缓存里就原样返回。 */
export function prependOwnMessage(
  data: TimelineData,
  message: MessageRead,
): TimelineData {
  if (hasMessage(data, messageKey(message))) return data;

  const head = data.pages[0];

  if (!head) return data;

  return replacePage(data, 0, insertByTime(head.items, message));
}

/** 全部页拍平（仍是 sentAt 倒序）；view 决定渲染方向。 */
export function flattenTimeline(data: TimelineData | undefined): MessageRead[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

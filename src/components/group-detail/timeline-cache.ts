// 时间线缓存的纯函数（游标分页 + 实时追加并存，frontend-realtime-events「列表」）。
// 缓存形状是 useInfiniteQuery 的 InfiniteData<MessagePage>：pages[0] 是最新页，每页 items 按 sentAt 倒序。
// 规则：新项只进 pages[0] 头部（按 sentAt 倒序找位置），pageParams 与旧页一律不动 —— 游标是「比某项更早」，
// 后来的新项不影响旧游标；更新按 key 在每一页就地替换；全程按 messageKey 去重。
// 断线补齐：从最新页往前翻，直到拉回的页接上缓存（catchUpAnchor / reachesAnchor），再一次性并进 pages[0]。
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

/**
 * 断线补齐的接上点。拉回的页只要包含它、或者比它更早，就说明与缓存之间没有空洞。
 * key 为 null 时只按时间判断。
 */
export interface CatchUpAnchor {
  key: string | null;
  sentAt: string;
}

/**
 * 缓存里最新的一条「位置可信」的消息：没有 clientMsgId 的行。带 clientMsgId 的是自己发的，
 * 可能是乐观插入（受理时刻由浏览器给），发出后 sentAt 还会变成网关时刻 —— 以它为接上点，
 * 断线期间排在它前面的消息会被漏掉。全是自己的消息时退到最旧的一条、只按时间判断（多翻几页，不漏）；
 * 缓存里一条都没有返回 null（调用方一直翻到头）。
 */
export function catchUpAnchor(data: TimelineData): CatchUpAnchor | null {
  let newestStable: MessageRead | null = null;
  let oldest: MessageRead | null = null;

  for (const item of flattenTimeline(data)) {
    if (
      item.clientMsgId === null &&
      (newestStable === null || item.sentAt > newestStable.sentAt)
    )
      newestStable = item;

    if (oldest === null || item.sentAt < oldest.sentAt) oldest = item;
  }

  if (newestStable)
    return { key: messageKey(newestStable), sentAt: newestStable.sentAt };

  return oldest ? { key: null, sentAt: oldest.sentAt } : null;
}

/** 拉回的这一页是否已经接上缓存：含接上点那一行，或有比它更早的行。 */
export function reachesAnchor(
  items: MessageRead[],
  anchor: CatchUpAnchor,
): boolean {
  return items.some(
    (item) =>
      (anchor.key !== null && messageKey(item) === anchor.key) ||
      item.sentAt < anchor.sentAt,
  );
}

/**
 * 全部页拍平（仍是 sentAt 倒序）；view 决定渲染方向。按 messageKey 跨页去重、留较新一页的那一行：
 * 自己消息的 sentAt 从受理时刻变成网关时刻后，同一条可能既在旧页（受理时刻拉到的）又在最新页。
 */
export function flattenTimeline(data: TimelineData | undefined): MessageRead[] {
  const seen = new Set<string>();
  const out: MessageRead[] = [];

  for (const page of data?.pages ?? []) {
    for (const item of page.items) {
      const key = messageKey(item);

      if (seen.has(key)) continue;

      seen.add(key);
      out.push(item);
    }
  }

  return out;
}

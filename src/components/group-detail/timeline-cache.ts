// 时间线缓存的纯函数（游标分页 + 实时追加并存，frontend-realtime-events「列表」）。
// 缓存形状是 useInfiniteQuery 的 InfiniteData<MessagePage>：pages[0] 是最新页，每页 items 按 sentAt 倒序。
// 规则：新项只进 pages[0] 头部（按 sentAt 倒序找位置），pageParams 与游标一律不动 —— 游标是「比某项更早」，
// 后来的新项不影响旧游标；全程按 messageKey 去重。
// 顺序（前端 #17）：后端按 (sentAt desc, id desc) 排，id 不下发，同一时刻的先后只能照搬后端给的顺序。
// 自己的消息排队时 sentAt 是受理时刻、发出后变成网关时刻（往后挪），所以 sentAt 一变就要重排：
// 合并最新页时整段按「最新页的顺序为准」重排 pages[0]，事件带 sentAt 时就地改并重排所在页，
// 拍平时再按 sentAt 稳定排一遍兜住跨页的情况。
// 断线补齐：从最新页往前翻，直到拉回的页接上缓存（catchUpAnchor / reachesAnchor），再一次性并进 pages[0]。
// 这里不碰 React / queryClient，由 use-message-timeline.ts 用 setQueryData 的函数式更新套上。

import type { InfiniteData } from "@tanstack/react-query";

import type { MessageEventPayload } from "@/lib/ws";
import {
  type DeliveryStatus,
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

/** 按 sentAt 倒序排（ISO 字符串直接比）。sort 是稳定的：同一时刻保持传入的相对顺序。 */
function sortByTime(items: MessageRead[]): MessageRead[] {
  return [...items].sort((a, b) =>
    a.sentAt === b.sentAt ? 0 : a.sentAt < b.sentAt ? 1 : -1,
  );
}

/**
 * 投递状态的档位（后端 outbox 的状态机）：queued / accepted / unknown 是中间态、彼此可来回
 * （unknown 确认没发出会回到 queued）；cancelled 之后仍可能落地成 sent；sent / failed 不再变。
 */
function settledRank(status: DeliveryStatus | null): number {
  if (status === "sent" || status === "failed") return 2;

  if (status === "cancelled") return 1;

  return 0;
}

/**
 * 最新页里的一行替换缓存里的同一行。最新页的档位比缓存低，说明这份快照早于缓存里那次就地更新
 * （请求在途时 WS 事件先到了，前端 #17）：投递相关的字段留缓存的，别把 sent 退回 accepted。
 */
function mergeRow(cached: MessageRead, fresh: MessageRead): MessageRead {
  if (settledRank(fresh.deliveryStatus) >= settledRank(cached.deliveryStatus))
    return fresh;

  return {
    ...fresh,
    msgId: cached.msgId ?? fresh.msgId,
    deliveryStatus: cached.deliveryStatus,
    failCode: cached.failCode,
    sentAt: cached.sentAt,
  };
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
 * `message` 事件带 clientMsgId 时，把投递状态（与发出后才有的 msgId）就地写进已有的行；
 * 事件带了 sentAt 且变了（受理时刻 → 网关时刻），所在页按新时刻重排。
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
    pages: data.pages.map((page) => {
      let moved = false;
      const items = page.items.map((item) => {
        if (messageKey(item) !== key) return item;

        const sentAt = payload.sentAt ?? item.sentAt;

        if (sentAt !== item.sentAt) moved = true;

        return {
          ...item,
          msgId: payload.msgId ?? item.msgId,
          deliveryStatus:
            payload.deliveryStatus === undefined
              ? item.deliveryStatus
              : payload.deliveryStatus,
          failCode:
            payload.failCode === undefined ? item.failCode : payload.failCode,
          sentAt,
        };
      });

      return { ...page, items: moved ? sortByTime(items) : items };
    }),
  };
}

/**
 * 把重新拉回的最新一段（从最新往前、连续的若干页，后端顺序）并进缓存：这一段里的行全部归到 pages[0]
 * （已有的行按 mergeRow 替换、从旧页上摘掉 —— sentAt 变过的自己消息可能挂在旧页上），再和 pages[0]
 * 里不在这一段的行（例如刚乐观插入的）一起按 sentAt 倒序稳定排序：这一段放前面，同一时刻就照搬后端的顺序。
 * 不重不漏，游标不动。
 */
export function mergeHeadPage(
  data: TimelineData,
  fresh: MessageRead[],
): TimelineData {
  if (!data.pages[0]) return data;

  const cached = new Map(
    flattenTimeline(data).map((item) => [messageKey(item), item]),
  );
  const merged = new Map<string, MessageRead>();

  // 跨页翻的时候同一行可能出现两次（翻页途中 sentAt 变了）：留较新一页的那份。
  for (const item of fresh) {
    const key = messageKey(item);

    if (merged.has(key)) continue;

    const old = cached.get(key);

    merged.set(key, old ? mergeRow(old, item) : item);
  }

  const notFresh = (items: MessageRead[]) =>
    items.filter((item) => !merged.has(messageKey(item)));

  return {
    ...data,
    pages: data.pages.map((page, i) => ({
      ...page,
      items:
        i === 0
          ? sortByTime([...merged.values(), ...notFresh(page.items)])
          : notFresh(page.items),
    })),
  };
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

/**
 * 事件指向的消息是否落在「已加载、但最新页补拉够不着」的那段历史里（前端 #23）：比补拉的接上点还早（补拉翻到
 * 接上点就停），又不早于缓存里最旧的一条（或者已经翻到头）。补投的旧消息（题目 2.1：sentAt 可以早任意时长）、
 * 旧消息的附件状态变化（后端 #59）都属于这种 —— 只补拉最新页看不到它们，要整份重拉。比已加载的还旧、又还没翻到头的
 * 不管：用户点「加载更早」时自然会拉到。
 */
export function isInLoadedHistory(data: TimelineData, sentAt: string): boolean {
  const anchor = catchUpAnchor(data);

  if (!anchor || sentAt >= anchor.sentAt) return false;

  if (data.pages.at(-1)?.nextCursor === null) return true;

  const items = flattenTimeline(data);
  const oldest = items.at(-1);

  return oldest !== undefined && sentAt >= oldest.sentAt;
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
 * 全部页拍平，按 sentAt 倒序；view 决定渲染方向。按 messageKey 跨页去重、留较新一页的那一行：
 * 自己消息的 sentAt 从受理时刻变成网关时刻后，同一条可能既在旧页（受理时刻拉到的）又在最新页。
 * 去重后再稳定排一遍：sentAt 就地变新的行可能还挂在旧页上（前端 #17），同一时刻保持页内 / 页间原顺序。
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

  return sortByTime(out);
}

// 群消息端点 wrapper（题目 2.3 `GET /api/groups/:id/messages`、`POST /api/groups/:id/send`）。
// 时间线是游标分页 { items, nextCursor }：items 按 sentAt 倒序，before 传上一页的 nextCursor；
// 游标对前端不透明，不解析。发送返回 202 { clientMsgId }：出站记录已落库（queued），真正发出由
// 后端 worker 派发，后续状态从时间线的 deliveryStatus（或 WS `message` 事件）看。

import { api } from "@/lib/api";
import { groupUrl } from "@/services/group-service";
import type { components, paths } from "@/types/api.generated";

export type MessagePage = components["schemas"]["MessagePage"];

export type MessageRead = components["schemas"]["MessageRead"];

export type DeliveryStatus = components["schemas"]["DeliveryStatus"];

export type SendResponse = components["schemas"]["SendResponse"];

export type SendMessagePayload =
  paths["/api/groups/{id}/send"]["post"]["requestBody"]["content"]["application/json"];

export interface ListMessagesParams {
  /** 上一页的 nextCursor；不传 = 从最新一条开始。 */
  before?: string;
  limit: number;
}

/** 一页的条数：与后端默认值一致（上限 200）。 */
export const MESSAGE_PAGE_LIMIT = 50;

// /api/groups 这个前缀的 owner 是 group-service（duplicate-endpoint-literal），这里只拼子路径。
export function messagesUrl(groupId: string): string {
  return `${groupUrl(groupId)}/messages`;
}

export function sendUrl(groupId: string): string {
  return `${groupUrl(groupId)}/send`;
}

export function listMessages(
  groupId: string,
  params: ListMessagesParams,
): Promise<MessagePage> {
  return api.get<MessagePage>(messagesUrl(groupId), {
    query: { before: params.before, limit: params.limit },
  });
}

export function sendMessage(
  groupId: string,
  payload: SendMessagePayload,
): Promise<SendResponse> {
  return api.post<SendResponse>(sendUrl(groupId), payload);
}

/**
 * 一条消息在前端的稳定标识。自己发的消息从 queued 起 msgId 为 null、发出后才有，
 * 所以优先用 clientMsgId；别人的消息只有 msgId；两者都没有（理论上不会）退回发送者 + 时刻。
 */
export function messageKey(message: MessageRead): string {
  return (
    message.clientMsgId ??
    message.msgId ??
    `${message.senderPlatformUserId}:${message.sentAt}`
  );
}

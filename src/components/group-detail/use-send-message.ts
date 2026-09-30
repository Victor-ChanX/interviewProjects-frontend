// 发消息这一条业务流：表单（RHF + zod）→ POST /api/groups/:id/send（202 { clientMsgId }）→
// 乐观插入一条自己的 queued 消息到时间线最新页（后续 WS `message` 事件按 clientMsgId 就地改状态）。
// 可选账号 = 本群成员里 status 为 online 的服务账号（GET /api/accounts 只在 admin 打开表单时才拉）。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { updateQueryData } from "@/lib/query-updates";
import { listAccounts } from "@/services/account-service";
import type { GroupMemberRead } from "@/services/group-service";
import { type MessageRead, sendMessage } from "@/services/message-service";

import {
  EMPTY_SEND_MESSAGE_FORM,
  type SendMessageFormValues,
  sendMessageSchema,
} from "./send-message-schema";
import { prependOwnMessage, type TimelineData } from "./timeline-cache";
import type { SendableAccount } from "./types";

export interface UseSendMessageOptions {
  groupId: string;
  members: GroupMemberRead[];
  /** viewer 不渲染表单，也不拉账号列表。 */
  enabled: boolean;
}

export function useSendMessage({
  groupId,
  members,
  enabled,
}: UseSendMessageOptions) {
  const queryClient = useQueryClient();
  const form = useForm<SendMessageFormValues>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: EMPTY_SEND_MESSAGE_FORM,
  });
  const { resetField } = form;

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: listAccounts,
    enabled,
  });

  const accounts = useMemo<SendableAccount[]>(() => {
    const online = new Set(
      (accountsQuery.data ?? [])
        .filter((account) => account.status === "online")
        .map((account) => account.id),
    );

    return members
      .filter(
        (member): member is GroupMemberRead & { accountId: string } =>
          member.accountId !== null && online.has(member.accountId),
      )
      .map((member) => ({
        accountId: member.accountId,
        platformUserId: member.platformUserId,
      }));
  }, [accountsQuery.data, members]);

  const mutation = useMutation({
    mutationFn: (values: SendMessageFormValues) => sendMessage(groupId, values),
  });
  const { mutateAsync } = mutation;

  const onValid = useCallback(
    async (values: SendMessageFormValues) => {
      try {
        const { clientMsgId } = await mutateAsync(values);
        const sender =
          members.find((member) => member.accountId === values.accountId)
            ?.platformUserId ?? values.accountId;

        const queued: MessageRead = {
          clientMsgId,
          msgId: null,
          isOwn: true,
          senderPlatformUserId: sender,
          text: values.text,
          // 受理时刻；发出后由重拉的最新页换成网关的 sentAt。
          sentAt: new Date().toISOString(),
          deliveryStatus: "queued",
          failCode: null,
          mediaUrl: null,
          localFilePath: null,
          mediaStatus: null,
        };

        // 「加载更早」进行中也不能被它的写回盖掉（前端 #16）。
        updateQueryData<TimelineData>(
          queryClient,
          queryKeys.messages.timeline(groupId),
          (old) => prependOwnMessage(old, queued),
        );
        resetField("text");
        toast.success("已受理，排队发送中");
      } catch (error) {
        toast.error(getErrorMessage(error, "发送失败，请重试"));
      }
    },
    [groupId, members, mutateAsync, queryClient, resetField],
  );

  return {
    accounts,
    accountsLoading: enabled && accountsQuery.isPending,
    register: form.register,
    errors: form.formState.errors,
    submit: form.handleSubmit(onValid),
    sending: mutation.isPending,
  };
}

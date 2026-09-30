// 「模拟外部发言」这一条业务流（前端 #19，后端 #46）：只在 admin 且后端开关打开时可用。
// 弹窗表单（RHF + zod）→ POST /api/groups/:id/simulate-inbound（202）→ toast、关弹窗、清空内容（发送者 ID 留着，
// 连发几条不用重填）。消息本身不在这里插缓存：它走网关模拟器 → 事件流 → 入站，和真实外部发言一样由 WS
// `message` 事件进时间线，这正是演示要看的路径。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import {
  getSimControls,
  simulateInbound,
} from "@/services/sim-control-service";

import {
  EMPTY_SIMULATE_INBOUND_FORM,
  type SimulateInboundFormValues,
  simulateInboundSchema,
} from "./simulate-inbound-schema";

export interface UseSimulateInboundOptions {
  groupId: string;
  /** viewer 不拉开关状态，入口也不出现。 */
  enabled: boolean;
}

export function useSimulateInbound({
  groupId,
  enabled,
}: UseSimulateInboundOptions) {
  const [open, setOpen] = useState(false);
  const form = useForm<SimulateInboundFormValues>({
    resolver: zodResolver(simulateInboundSchema),
    defaultValues: EMPTY_SIMULATE_INBOUND_FORM,
  });
  const { resetField } = form;

  const controls = useQuery({
    queryKey: queryKeys.simControls.status(),
    queryFn: getSimControls,
    enabled,
    // 开关只随后端重新部署变化
    staleTime: Infinity,
    // 拿不到就当没开：入口不出现，不打扰
    meta: { silent: true },
  });

  const mutation = useMutation({
    mutationFn: (values: SimulateInboundFormValues) =>
      simulateInbound(groupId, values),
  });
  const { mutateAsync } = mutation;

  const onValid = useCallback(
    async (values: SimulateInboundFormValues) => {
      try {
        await mutateAsync(values);
        resetField("text");
        setOpen(false);
        toast.success(
          `已以 ${values.senderPlatformUserId} 的身份推送，稍后出现在时间线`,
        );
      } catch (error) {
        toast.error(getErrorMessage(error, "推送失败，请重试"));
      }
    },
    [mutateAsync, resetField],
  );

  return {
    available: enabled && controls.data?.enabled === true,
    open,
    setOpen,
    register: form.register,
    errors: form.formState.errors,
    submit: form.handleSubmit(onValid),
    submitting: mutation.isPending,
  };
}

// 「新增账号」这一条业务流（前端 #26，后端 #63）：admin 才有入口。弹窗表单（RHF + zod）→ POST /api/accounts（201）
// → toast、关弹窗、清空、刷新账号列表（新账号 idle，可以直接点「重连」连上）。id 已存在显示后端的整句提示。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { createAccount } from "@/services/account-service";

import {
  type CreateAccountFormValues,
  createAccountSchema,
  EMPTY_CREATE_ACCOUNT_FORM,
} from "./create-account-schema";

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: EMPTY_CREATE_ACCOUNT_FORM,
  });
  const { reset } = form;

  const mutation = useMutation({
    mutationFn: (values: CreateAccountFormValues) => createAccount(values.id),
  });
  const { mutateAsync } = mutation;

  const onValid = useCallback(
    async (values: CreateAccountFormValues) => {
      try {
        const account = await mutateAsync(values);

        void queryClient.invalidateQueries({
          queryKey: queryKeys.accounts.all,
        });
        reset(EMPTY_CREATE_ACCOUNT_FORM);
        setOpen(false);
        toast.success(`已新增账号 ${account.id}，可以点「重连」连上网关`);
      } catch (error) {
        toast.error(getErrorMessage(error, "新增失败，请重试"));
      }
    },
    [mutateAsync, queryClient, reset],
  );

  return {
    open,
    setOpen,
    register: form.register,
    errors: form.formState.errors,
    submit: form.handleSubmit(onValid),
    submitting: mutation.isPending,
  };
}

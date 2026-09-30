// 新建序列（POST /api/sequences）这一小条流：弹窗里的表单（RHF + zod，steps 行数组）→ createSequence →
// 成功后重拉序列列表、清表单、关弹窗。前端 #12 从序列运行页的折叠表单挪到「定时序列」页的对话框。
// 关弹窗不清表单：填了一半关掉再打开还在（保存成功才清）。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import {
  createSequence,
  type SequenceDefinitionPayload,
} from "@/services/sequence-service";

import {
  type CreateSequenceFormInput,
  type CreateSequenceFormValues,
  createSequenceSchema,
  EMPTY_CREATE_FORM,
  toSequenceDefinitionPayload,
} from "./create-sequence-schema";

export function useCreateSequence() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<
    CreateSequenceFormInput,
    unknown,
    CreateSequenceFormValues
  >({
    resolver: zodResolver(createSequenceSchema),
    defaultValues: EMPTY_CREATE_FORM,
  });
  const { control, handleSubmit, reset } = form;
  const stepRows = useFieldArray({ control, name: "steps" });

  const mutation = useMutation({
    mutationFn: (definition: SequenceDefinitionPayload) =>
      createSequence(definition),
  });
  const { mutateAsync } = mutation;

  const onValid = useCallback(
    async (values: CreateSequenceFormValues) => {
      try {
        await mutateAsync(toSequenceDefinitionPayload(values));

        await queryClient.invalidateQueries({
          queryKey: queryKeys.sequences.all,
        });
        reset(EMPTY_CREATE_FORM);
        setOpen(false);
        toast.success(`序列「${values.name}」已创建`);
      } catch (error) {
        toast.error(getErrorMessage(error, "创建失败，请重试"));
      }
    },
    [mutateAsync, queryClient, reset],
  );

  return {
    open,
    setOpen,
    register: form.register,
    errors: form.formState.errors,
    steps: stepRows,
    submitting: mutation.isPending,
    submit: handleSubmit(onValid),
  };
}

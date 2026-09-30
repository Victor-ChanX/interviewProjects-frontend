// 新建序列（POST /api/sequences）这一小条流：表单（RHF + zod，steps 行数组）→ createSequence →
// 成功后重拉序列列表、清表单，并把新序列的 id 交给调用方（启动表单顺手选中它）。
// 没有这个入口页面就没有序列可选，所以放在同一页做成折叠表单。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
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
} from "./sequence-run-schema";

export function useCreateSequence(onCreated: (id: string) => void) {
  const queryClient = useQueryClient();
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
        const { id } = await mutateAsync(toSequenceDefinitionPayload(values));

        await queryClient.invalidateQueries({
          queryKey: queryKeys.sequences.all,
        });
        reset(EMPTY_CREATE_FORM);
        onCreated(id);
        toast.success(`序列「${values.name}」已创建`);
      } catch (error) {
        toast.error(getErrorMessage(error, "创建失败，请重试"));
      }
    },
    [mutateAsync, onCreated, queryClient, reset],
  );

  return {
    register: form.register,
    errors: form.formState.errors,
    steps: stepRows,
    submitting: mutation.isPending,
    submit: handleSubmit(onValid),
  };
}

// 新建序列表单的校验（校验权威只有 zod 一处；<form noValidate>）与「表单值 → 请求体」的纯转换（题目 B1 的序列 JSON）。
// index 由行的位置派生（后端要求从 1 连续）。从序列运行页挪到定时序列页（前端 #12）。

import { z } from "zod";

import type { SequenceDefinitionPayload } from "@/services/sequence-service";

const stepDefinitionRowSchema = z.object({
  accountRole: z.enum(["admin", "member"]),
  text: z.string().trim().min(1, "请填写文本"),
  delaySeconds: z.coerce
    .number({ message: "请填写延迟秒数" })
    .int("延迟秒数必须是整数")
    .min(0, "延迟秒数不能为负"),
});

export const createSequenceSchema = z.object({
  name: z.string().trim().min(1, "请填写序列名称"),
  steps: z.array(stepDefinitionRowSchema).min(1, "至少一步"),
});

export type CreateSequenceFormValues = z.infer<typeof createSequenceSchema>;

/** RHF 的输入形状（coerce / trim 之前）：delaySeconds 在输入框里是字符串。 */
export type CreateSequenceFormInput = z.input<typeof createSequenceSchema>;

export const EMPTY_STEP_ROW: CreateSequenceFormInput["steps"][number] = {
  accountRole: "admin",
  text: "",
  delaySeconds: 0,
};

export const EMPTY_CREATE_FORM: CreateSequenceFormInput = {
  name: "",
  steps: [EMPTY_STEP_ROW],
};

/** index 按行位置从 1 连续编号（后端 SequenceDefinition 的要求）。 */
export function toSequenceDefinitionPayload(
  values: CreateSequenceFormValues,
): SequenceDefinitionPayload {
  return {
    name: values.name,
    steps: values.steps.map((step, i) => ({
      index: i + 1,
      accountRole: step.accountRole,
      text: step.text,
      delaySeconds: step.delaySeconds,
    })),
  };
}

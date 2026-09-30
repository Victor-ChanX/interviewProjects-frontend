// 序列运行页启动表单的校验（校验权威只有 zod 一处；<form noValidate>）与「表单值 → 请求体」的纯转换。
//
// 启动表单：vars / stepVars 在表单里是行数组（useFieldArray 好增删），发给后端前折成题目 2.3 的
// { vars: { key: value }, stepVars: { "<index>": { key: value } } }。value 允许空串：vars 里的 "" 视为未提供、
// stepVars 里的 "" 表示这一步不改（B1），所以这里不 trim、不去掉空值 —— 那是取值规则的语义，不是脏数据。

import { z } from "zod";

import type { StartSequenceRunPayload } from "@/services/sequence-service";

const VAR_KEY_MESSAGE = "key 只能是字母、数字、下划线";

const varKeySchema = z
  .string()
  .min(1, "请填写 key")
  .regex(/^[A-Za-z0-9_]+$/, VAR_KEY_MESSAGE);

const varRowSchema = z.object({
  key: varKeySchema,
  value: z.string(),
});

const stepVarRowSchema = z.object({
  /** 表单里是 select 的字符串值；后端 stepVars 的键本来就是 index 的十进制字符串。 */
  stepIndex: z.string().regex(/^[1-9]\d*$/, "请选择步骤"),
  key: varKeySchema,
  value: z.string(),
});

export const startSequenceRunSchema = z.object({
  sequenceId: z.string().min(1, "请选择序列"),
  vars: z.array(varRowSchema),
  stepVars: z.array(stepVarRowSchema),
});

export type StartSequenceRunFormValues = z.infer<typeof startSequenceRunSchema>;

export const EMPTY_START_FORM: StartSequenceRunFormValues = {
  sequenceId: "",
  vars: [],
  stepVars: [],
};

/**
 * 同一 key 出现多行时后一行覆盖前一行（与 JSON 对象的语义一致）。
 * 折成的对象不带原型：`__proto__` 过得了 key 校验，写进普通 {} 会走原型 setter、被静默丢掉。
 */
export function toStartSequenceRunPayload(
  values: StartSequenceRunFormValues,
): StartSequenceRunPayload {
  const vars: Record<string, string> = Object.create(null);

  for (const row of values.vars) vars[row.key] = row.value;

  const stepVars: Record<string, Record<string, string>> = Object.create(null);

  for (const row of values.stepVars) {
    const step = (stepVars[row.stepIndex] ??= Object.create(null));

    step[row.key] = row.value;
  }

  return { sequenceId: values.sequenceId, vars, stepVars };
}

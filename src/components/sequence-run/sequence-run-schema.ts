// 序列运行页两张表单的校验（校验权威只有 zod 一处；<form noValidate>）与「表单值 → 请求体」的纯转换。
//
// 启动表单：vars / stepVars 在表单里是行数组（useFieldArray 好增删），发给后端前折成题目 2.3 的
// { vars: { key: value }, stepVars: { "<index>": { key: value } } }。value 允许空串：vars 里的 "" 视为未提供、
// stepVars 里的 "" 表示这一步不改（B1），所以这里不 trim、不去掉空值 —— 那是取值规则的语义，不是脏数据。
// 新建序列表单：index 由行的位置派生（后端要求从 1 连续）。

import { z } from "zod";

import type {
  SequenceDefinitionPayload,
  StartSequenceRunPayload,
} from "@/services/sequence-service";

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

/** 同一 key 出现多行时后一行覆盖前一行（与 JSON 对象的语义一致）。 */
export function toStartSequenceRunPayload(
  values: StartSequenceRunFormValues,
): StartSequenceRunPayload {
  const vars: Record<string, string> = {};

  for (const row of values.vars) vars[row.key] = row.value;

  const stepVars: Record<string, Record<string, string>> = {};

  for (const row of values.stepVars) {
    const step = (stepVars[row.stepIndex] ??= {});

    step[row.key] = row.value;
  }

  return { sequenceId: values.sequenceId, vars, stepVars };
}

// ---- 新建序列 ----

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

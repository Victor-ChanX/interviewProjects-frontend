// 「新增账号」表单的校验（校验权威只有 zod 一处；<form noValidate>）。规则与后端 AccountCreateRequest 一致（后端 #63）。

import { z } from "zod";

export const createAccountSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9_-]{0,31}$/,
      "只能用小写字母、数字、- 和 _，以字母或数字开头，最长 32 个字符",
    ),
});

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>;

export const EMPTY_CREATE_ACCOUNT_FORM: CreateAccountFormValues = { id: "" };

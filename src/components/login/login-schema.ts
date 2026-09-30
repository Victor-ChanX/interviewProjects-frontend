// 登录表单的校验权威（<form noValidate> + zodResolver）。长度上限与后端 src/schemas/auth.ts 的
// LoginRequest 同口径，前端只是早一步给出文案；空值提示比后端的 400 VALIDATION_ERROR 友好。

import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "请输入用户名")
    .max(64, "用户名不能超过 64 个字符"),
  password: z.string().min(1, "请输入密码").max(256, "密码不能超过 256 个字符"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

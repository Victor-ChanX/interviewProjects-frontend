// 「模拟外部发言」表单的校验（校验权威只有 zod 一处；<form noValidate>）。上限与后端 SimulateInboundRequest 一致，
// 首尾空白去掉（后端同样 trim，只有空格的内容会被 400）。

import { z } from "zod";

export const simulateInboundSchema = z.object({
  senderPlatformUserId: z
    .string()
    .trim()
    .min(1, "请填写外部成员 ID")
    .max(64, "外部成员 ID 不能超过 64 个字符"),
  text: z
    .string()
    .trim()
    .min(1, "消息内容不能为空")
    .max(2000, "消息内容不能超过 2000 个字符"),
});

export type SimulateInboundFormValues = z.infer<typeof simulateInboundSchema>;

/** 默认的外部成员 ID：不与托管账号的 platformUserId（pu_ 开头）撞上。 */
export const EMPTY_SIMULATE_INBOUND_FORM: SimulateInboundFormValues = {
  senderPlatformUserId: "ext-demo",
  text: "",
};

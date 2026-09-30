// 发消息表单的校验（校验权威只有 zod 一处；<form noValidate>）。后端 SendRequest 只要求两个非空串，
// 前端再把首尾空白去掉，避免发出一条只有空格的消息。

import { z } from "zod";

export const sendMessageSchema = z.object({
  accountId: z.string().min(1, "请选择发送账号"),
  text: z.string().trim().min(1, "消息内容不能为空"),
});

export type SendMessageFormValues = z.infer<typeof sendMessageSchema>;

/** RHF 的输入形状（trim 之前）；与输出同形，单独起名只为语义清楚。 */
export type SendMessageFormInput = z.input<typeof sendMessageSchema>;

export const EMPTY_SEND_MESSAGE_FORM: SendMessageFormInput = {
  accountId: "",
  text: "",
};

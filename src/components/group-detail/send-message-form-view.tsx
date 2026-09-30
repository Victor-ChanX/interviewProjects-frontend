// 发消息表单：纯展示。RHF 的 register / errors / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 账号下拉只列本群里 online 的服务账号（由 hook 算好）。

import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import type { SendMessageFormViewProps } from "./types";

export function SendMessageFormView({
  accounts,
  accountsLoading,
  register,
  errors,
  sending,
  disabledReason,
  onSubmit,
}: SendMessageFormViewProps) {
  const disabled = disabledReason !== null || sending;
  const noAccount = !accountsLoading && accounts.length === 0;

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={onSubmit}>
      {disabledReason ? (
        <p className="text-sm text-destructive">{disabledReason}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5 sm:w-60">
          <Label htmlFor="send-account">发送账号</Label>
          <NativeSelect
            id="send-account"
            className="w-full"
            disabled={disabled || accountsLoading}
            aria-invalid={errors.accountId ? true : undefined}
            {...register("accountId")}
          >
            <NativeSelectOption value="">
              {accountsLoading
                ? "加载账号中…"
                : noAccount
                  ? "没有在线的成员账号"
                  : "请选择"}
            </NativeSelectOption>
            {accounts.map((account) => (
              <NativeSelectOption
                key={account.accountId}
                value={account.accountId}
              >
                {account.accountId}（{account.platformUserId}）
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.accountId ? (
            <p className="text-xs text-destructive">
              {errors.accountId.message}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="send-text">消息内容</Label>
          <Textarea
            id="send-text"
            rows={2}
            className="min-h-16 resize-y bg-card"
            placeholder="输入要发送的消息"
            disabled={disabled}
            aria-invalid={errors.text ? true : undefined}
            {...register("text")}
          />
          {errors.text ? (
            <p className="text-xs text-destructive">{errors.text.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          发送后先显示「排队中」，网关受理与送达后状态实时更新。
        </p>
        <Button type="submit" disabled={disabled || noAccount}>
          <SendHorizontal />
          {sending ? "发送中…" : "发送"}
        </Button>
      </div>
    </form>
  );
}

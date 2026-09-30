// 发消息表单：纯展示。RHF 的 register / errors / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 账号下拉只列本群里 online 的服务账号（由 hook 算好）。

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { SendMessageFormViewProps } from "./types";

const CONTROL_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="send-account">发送账号</Label>
        <select
          id="send-account"
          className={cn(CONTROL_CLASS, "h-9")}
          disabled={disabled || accountsLoading}
          aria-invalid={errors.accountId ? true : undefined}
          {...register("accountId")}
        >
          <option value="">
            {accountsLoading
              ? "加载账号中…"
              : noAccount
                ? "没有在线的成员账号"
                : "请选择"}
          </option>
          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.platformUserId}（{account.accountId}）
            </option>
          ))}
        </select>
        {errors.accountId ? (
          <p className="text-xs text-destructive">{errors.accountId.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="send-text">消息内容</Label>
        <textarea
          id="send-text"
          rows={3}
          className={cn(CONTROL_CLASS, "resize-y")}
          placeholder="输入要发送的消息"
          disabled={disabled}
          aria-invalid={errors.text ? true : undefined}
          {...register("text")}
        />
        {errors.text ? (
          <p className="text-xs text-destructive">{errors.text.message}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={disabled || noAccount}
      >
        {sending ? "发送中…" : "发送"}
      </Button>
    </form>
  );
}

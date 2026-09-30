// 新建群弹窗：纯展示。两段：填表（群主下拉 + 成员勾选，勾选顺序即提交顺序）→ 进度（共享的 JobProgress）。
// 三段式外壳（DIALOG_SHELL + DialogBody）：账号多时只有 body 滚，footer 的「创建」恒定可见；
// 提交按钮在 footer（不在 <form> 里），用原生 form 属性关联。校验权威只有 zod，所以 <form noValidate>。

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { JobProgress } from "@/components/ui-atoms/job-progress";
import { cn } from "@/lib/utils";

import type {
  CreateGroupAccountOption,
  CreateGroupDialogViewProps,
} from "./types";

const FORM_ID = "create-group-form";

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function accountLabel(account: CreateGroupAccountOption): string {
  return account.platformUserId
    ? `${account.platformUserId}（${account.id}）`
    : account.id;
}

export function CreateGroupDialogView({
  open,
  onOpenChange,
  accounts,
  accountsLoading,
  accountsError,
  creatorAccountId,
  memberAccountIds,
  errors,
  onCreatorChange,
  onToggleMember,
  submitting,
  submitError,
  onSubmit,
  progress,
}: CreateGroupDialogViewProps) {
  const candidates = accounts.filter(
    (account) => account.id !== creatorAccountId,
  );
  const noAccount = !accountsLoading && accounts.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>新建群</DialogTitle>
          <DialogDescription>
            {progress
              ? "建群任务在后台执行；关闭弹窗不会中断它。"
              : "只能选在线账号。第一个成员会被提升为管理员。"}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {progress ? (
            <JobProgress
              job={progress.job}
              errorMessage={progress.errorMessage}
            />
          ) : (
            <form
              id={FORM_ID}
              noValidate
              className="flex flex-col gap-4"
              onSubmit={onSubmit}
            >
              {accountsError ? (
                <p className="text-sm text-destructive">{accountsError}</p>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-group-creator">群主</Label>
                <select
                  id="create-group-creator"
                  className={CONTROL_CLASS}
                  value={creatorAccountId}
                  disabled={accountsLoading || submitting}
                  aria-invalid={errors.creatorAccountId ? true : undefined}
                  onChange={(event) => onCreatorChange(event.target.value)}
                >
                  <option value="">
                    {accountsLoading
                      ? "加载账号中…"
                      : noAccount
                        ? "没有在线账号"
                        : "请选择"}
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}
                    </option>
                  ))}
                </select>
                {errors.creatorAccountId ? (
                  <p className="text-xs text-destructive">
                    {errors.creatorAccountId}
                  </p>
                ) : null}
              </div>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium">成员</legend>
                <p className="mb-1 text-xs text-muted-foreground">
                  按勾选顺序加入；第一个成员会被提升为管理员。至少选 1 个。
                </p>
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {accountsLoading
                      ? "加载账号中…"
                      : "没有可选的在线账号（群主不能同时是成员）"}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {candidates.map((account) => {
                      const order = memberAccountIds.indexOf(account.id);
                      const inputId = `create-group-member-${account.id}`;

                      return (
                        <li key={account.id}>
                          <label
                            htmlFor={inputId}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50"
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={order !== -1}
                              disabled={submitting}
                              onChange={() => onToggleMember(account.id)}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {accountLabel(account)}
                            </span>
                            {order !== -1 ? (
                              <Badge variant="outline" className="tabular-nums">
                                #{order + 1}
                                {order === 0 ? " 管理员" : null}
                              </Badge>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {errors.memberAccountIds ? (
                  <p className="text-xs text-destructive">
                    {errors.memberAccountIds}
                  </p>
                ) : null}
              </fieldset>

              {submitError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          {/* Button 渲染成 DialogClose：ui/button 没有 forwardRef，反过来写 Base UI 会往 Button 上挂 ref 而告警。 */}
          {progress ? (
            <Button variant="outline" render={<DialogClose />}>
              {progress.running ? "后台运行" : "关闭"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                render={<DialogClose />}
                disabled={submitting}
              >
                取消
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                disabled={submitting || accountsLoading}
              >
                {submitting ? "提交中…" : "创建"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

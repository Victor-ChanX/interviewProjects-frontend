// 「新增账号」弹窗：纯展示。RHF 的 register / errors / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 三段式外壳（DIALOG_SHELL + DialogBody）：提交按钮在 footer，用 form 属性关联表单。

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { cn } from "@/lib/utils";

import type { CreateAccountDialogViewProps } from "./types";

const FORM_ID = "create-account-form";

export function CreateAccountDialogView({
  open,
  onOpenChange,
  register,
  errors,
  submitting,
  onSubmit,
}: CreateAccountDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>新增账号</DialogTitle>
          <DialogDescription>
            新账号是「空闲」状态，新增后点「重连」把它连到消息网关。
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={FORM_ID}
            noValidate
            className="flex flex-col gap-1.5"
            onSubmit={onSubmit}
          >
            <Label htmlFor="create-account-id">账号 ID</Label>
            <Input
              id="create-account-id"
              autoComplete="off"
              placeholder="例如：acc-6"
              disabled={submitting}
              aria-invalid={errors.id ? true : undefined}
              {...register("id")}
            />
            {errors.id ? (
              <p className="text-xs text-destructive">{errors.id.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                小写字母、数字、- 和 _，最长 32 个字符。
              </p>
            )}
          </form>
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" />}
            disabled={submitting}
          >
            取消
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={submitting}>
            {submitting ? "新增中…" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 新建序列对话框：纯展示。三段式外壳（DIALOG_SHELL + DialogBody）：步骤多时只有 body 滚，footer 的「创建序列」
// 恒定可见；提交按钮在 footer，用原生 form 属性关联表单。

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
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { cn } from "@/lib/utils";

import { CreateSequenceFormView } from "./create-sequence-form-view";
import type { CreateSequenceDialogViewProps } from "./types";

export function CreateSequenceDialogView({
  open,
  onOpenChange,
  form,
}: CreateSequenceDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>新建序列</DialogTitle>
          <DialogDescription>
            一个序列是按顺序发言的若干步：每步指定由管理员还是成员账号发、发什么、等多久。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CreateSequenceFormView {...form} />
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" />}
            disabled={form.submitting}
          >
            取消
          </DialogClose>
          <Button type="submit" form={form.formId} disabled={form.submitting}>
            {form.submitting ? "创建中…" : "创建序列"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

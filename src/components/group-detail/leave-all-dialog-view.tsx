// 全部退群弹窗：纯展示。两段：确认（说明退群顺序与失败时的行为）→ 进度（共享的 JobProgress）。
// 三段式外壳（DIALOG_SHELL + DialogBody）：失败步骤多时只有 body 滚，footer 恒定可见。

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { JobProgress } from "@/components/ui-atoms/job-progress";
import { cn } from "@/lib/utils";

import type { LeaveAllDialogViewProps } from "./types";

export function LeaveAllDialogView({
  open,
  onOpenChange,
  groupLabel,
  submitting,
  submitError,
  onConfirm,
  progress,
}: LeaveAllDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>全部退群</DialogTitle>
          <DialogDescription>
            群 <span className="font-mono">{groupLabel}</span>{" "}
            里的所有服务账号退群
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          {progress ? (
            <JobProgress
              job={progress.job}
              errorMessage={progress.errorMessage}
            />
          ) : (
            <>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>非群主账号先逐个退群，群主最后退。</li>
                <li>
                  任一账号退群失败，群主不退、群保持原状态，失败的步骤会列出来。
                </li>
                <li>全部成功后群变为「已退出」，成员表清空，不能再发消息。</li>
              </ul>
              {submitError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {progress ? (
            <DialogClose render={<Button variant="outline" />}>
              {progress.running ? "后台运行" : "关闭"}
            </DialogClose>
          ) : (
            <>
              <DialogClose
                render={<Button variant="outline" />}
                disabled={submitting}
              >
                取消
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={onConfirm}
              >
                {submitting ? "提交中…" : "确认退群"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

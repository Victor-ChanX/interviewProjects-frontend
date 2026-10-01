// 删除群的确认弹窗：纯展示。说明会一并删掉什么、不可恢复；提交中禁用按钮。

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

import type { DeleteGroupDialogViewProps } from "./types";

export function DeleteGroupDialogView({
  open,
  onOpenChange,
  groupLabel,
  deleting,
  onConfirm,
}: DeleteGroupDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>删除群</DialogTitle>
          <DialogDescription>
            删除已退出的群 <span className="font-mono">{groupLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              这个群的消息、Agent 运行与序列运行记录会一起删除，不可恢复。
            </li>
            <li>已下载的附件文件稍后由媒体清理一并删掉。</li>
            <li>网关那边不受影响（服务账号都已退出这个群）。</li>
          </ul>
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" />}
            disabled={deleting}
          >
            取消
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "删除中…" : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

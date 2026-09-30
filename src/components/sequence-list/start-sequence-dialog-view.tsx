// 「在群启动」对话框：选一个状态正常的群 → 去该群的序列运行页（那里预检、启动、看进度）。纯展示。

import { ArrowRight } from "lucide-react";

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
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { cn } from "@/lib/utils";

import type { StartSequenceDialogViewProps } from "./types";

export function StartSequenceDialogView({
  open,
  onOpenChange,
  sequence,
  groupOptions,
  groupsLoading,
  groupId,
  onGroupChange,
  onConfirm,
}: StartSequenceDialogViewProps) {
  const noGroup = !groupsLoading && groupOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>在群里启动「{sequence?.name ?? ""}」</DialogTitle>
          <DialogDescription>
            选一个群，进入它的序列运行页：填占位符取值、预检通过后再启动。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-1.5">
          <Label htmlFor="start-sequence-group">群</Label>
          <NativeSelect
            id="start-sequence-group"
            className="w-full"
            value={groupId}
            disabled={groupsLoading || noGroup}
            onChange={(event) => onGroupChange(event.target.value)}
          >
            <NativeSelectOption value="">
              {groupsLoading
                ? "加载群中…"
                : noGroup
                  ? "没有状态正常的群"
                  : "请选择"}
            </NativeSelectOption>
            {groupOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            只列状态正常的群：不可写或已退出的群不能发言。
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button disabled={!groupId} onClick={onConfirm}>
            去序列运行
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

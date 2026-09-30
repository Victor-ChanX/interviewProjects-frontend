// 协议错误步的原始响应体浮层：纯展示。三段式外壳（DIALOG_SHELL + DialogBody）：只有 <pre> 所在的 body 滚，
// 关闭按钮固定在 footer。rawResponse 后端已截到 2KB，仍可能是一整行坏 JSON，所以 pre 要换行。

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

import type { RawResponseDialogViewProps } from "./types";

export function RawResponseDialogView({
  open,
  step,
  onOpenChange,
}: RawResponseDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>原始响应体</DialogTitle>
          <DialogDescription>
            第 {step?.index ?? "-"} 步
            {step?.errorCode ? `（${step.errorCode}）` : null}
            ，Agent 服务返回的原文，超过 2KB 的部分已被截断
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <pre className="rounded-md bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {step?.rawResponse ?? "（无原始响应）"}
          </pre>
        </DialogBody>
        <DialogFooter>
          {/* 方向是 Button 渲染成 DialogClose：ui/button 没有 forwardRef，反过来写 Base UI 会往 Button 上挂 ref 而告警。 */}
          <Button variant="outline" render={<DialogClose />}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

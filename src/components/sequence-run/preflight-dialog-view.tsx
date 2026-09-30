// 预检弹窗：纯展示。每步一块：原文 → 最终文本，下面一张「key / 最终取值 / 来源」小表；本地解析不到的 key
// 整行标红、顶部 Alert 列出全部 { stepIndex, key }，「启动」按钮禁用。三段式外壳（DIALOG_SHELL + DialogBody）：
// 步骤多时只有 body 滚，footer 的「启动」恒定可见。步骤内的子表用原生 <table className="text-xs">。

import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { cn } from "@/lib/utils";

import type { PreflightDialogViewProps } from "./types";

const SOURCE_LABEL: Readonly<Record<"default" | "step", string>> = {
  default: "vars",
  step: "stepVars",
};

function sourceLabel(source: string): string {
  if (source === "default") return SOURCE_LABEL.default;

  const index = source.slice("step:".length);

  return `${SOURCE_LABEL.step} 第 ${index} 步`;
}

export function PreflightDialogView({
  open,
  result,
  starting,
  onOpenChange,
  onConfirm,
}: PreflightDialogViewProps) {
  const unresolved = result?.unresolved ?? [];
  const blocked = unresolved.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>预检</DialogTitle>
          <DialogDescription>
            每步每个占位符的最终取值与来源（本地按题目 B1
            的取值规则算；后端启动时再检一遍）
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {blocked ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>
                有 {unresolved.length} 个占位符解析不到，不能启动
              </AlertTitle>
              <AlertDescription>
                {unresolved.map((item) => (
                  <p
                    key={`${item.stepIndex}:${item.key}`}
                    className="font-mono text-xs"
                  >
                    第 {item.stepIndex} 步 · {`{${item.key}}`}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          {result?.steps.map((step) => (
            <section
              key={step.index}
              className="flex flex-col gap-2 rounded-md border border-border p-3"
            >
              <header className="flex items-center gap-2">
                <Badge variant="outline">第 {step.index} 步</Badge>
                <span className="break-all text-sm text-muted-foreground">
                  {step.text}
                </span>
              </header>
              <p className="break-all text-sm">
                <span className="text-muted-foreground">→ </span>
                {step.rendered}
              </p>
              {step.entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">没有占位符</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">key</th>
                      <th className="py-1 pr-3 font-medium">最终取值</th>
                      <th className="py-1 font-medium">来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.entries.map((entry) => (
                      <tr
                        key={entry.key}
                        className={cn({
                          "bg-destructive/10 text-destructive":
                            entry.value === null,
                        })}
                      >
                        <td className="py-1 pr-3 font-mono">{entry.key}</td>
                        <td className="break-all py-1 pr-3">
                          {entry.value === null ? "解析不到" : entry.value}
                        </td>
                        <td className="py-1">
                          {entry.source === null
                            ? "-"
                            : sourceLabel(entry.source)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" />}
            disabled={starting}
          >
            取消
          </DialogClose>
          <Button
            type="button"
            disabled={blocked || starting || !result}
            onClick={onConfirm}
          >
            {starting ? "启动中…" : "启动"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

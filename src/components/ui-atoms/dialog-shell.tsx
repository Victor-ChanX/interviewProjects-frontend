// 浮层的三段式外壳（frontend-overlay-layout「shadcn / base-ui 仓」）：限高加在整体、只让 body 滚，
// header / footer 留在滚动区之外，主操作恒定可见。用法：
//   <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-2xl")}>
//     <DialogHeader>…</DialogHeader>
//     <DialogBody>…</DialogBody>
//     <DialogFooter>…</DialogFooter>
//   </DialogContent>
// 在 DialogContent 上手写 max-h / overflow 由 eslint 拦（豁免名就是 DIALOG_SHELL）。ui/dialog.tsx 保持上游形状不改。

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 用 dvh 不用 vh：移动端地址栏收起 / 展开时 vh 不变，浮层底部会被盖住。 */
export const DIALOG_SHELL = "flex max-h-[85dvh] flex-col";

/**
 * 唯一允许滚动的那一段。`min-h-0` 不能省（flex 子项默认 min-height:auto 拒绝收缩，overflow 失效）；
 * 不加 `flex-1`（内容装得下时也会多出滚动区）；`-mx-6 px-6` 抵消 DialogContent 的 p-6，让滚动条贴边；
 * `pb-2 -mb-2` 给行盒溢出的几像素余量，免得冒出一条没有内容可滚的假滚动条。
 */
export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("-mx-6 -mb-2 min-h-0 overflow-y-auto px-6 pb-2", className)}
    >
      {children}
    </div>
  );
}

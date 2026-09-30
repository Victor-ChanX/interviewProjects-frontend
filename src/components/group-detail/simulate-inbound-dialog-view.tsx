// 「模拟外部发言」弹窗：纯展示。RHF 的 register / errors / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 三段式外壳（DIALOG_SHELL + DialogBody）：只有 body 滚，提交按钮恒定可见（按钮在 footer，用 form 属性关联表单）。

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
import { Textarea } from "@/components/ui/textarea";
import { DIALOG_SHELL, DialogBody } from "@/components/ui-atoms/dialog-shell";
import { cn } from "@/lib/utils";

import type { SimulateInboundDialogViewProps } from "./types";

const FORM_ID = "simulate-inbound-form";

export function SimulateInboundDialogView({
  open,
  onOpenChange,
  register,
  errors,
  submitting,
  agentEnabled,
  onSubmit,
  imageName,
  imageError,
  imageInputKey,
  onImageChange,
  onClearImage,
}: SimulateInboundDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SHELL, "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle>模拟外部成员发言</DialogTitle>
          <DialogDescription>
            演示用：以一个外部成员的身份往群里发一条消息，经网关模拟器进入时间线。
            {agentEnabled
              ? "本群开着 Agent 自动回复，会触发一次运行。"
              : "本群没开 Agent 自动回复，不会触发运行。"}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={FORM_ID}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={onSubmit}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="simulate-sender">外部成员 ID</Label>
              <Input
                id="simulate-sender"
                autoComplete="off"
                disabled={submitting}
                aria-invalid={errors.senderPlatformUserId ? true : undefined}
                {...register("senderPlatformUserId")}
              />
              {errors.senderPlatformUserId ? (
                <p className="text-xs text-destructive">
                  {errors.senderPlatformUserId.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  不能是本平台托管账号的 ID。
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="simulate-text">消息内容</Label>
              <Textarea
                id="simulate-text"
                rows={3}
                className="min-h-20 resize-y"
                placeholder="例如：请问活动几点开始？"
                disabled={submitting}
                aria-invalid={errors.text ? true : undefined}
                {...register("text")}
              />
              {errors.text ? (
                <p className="text-xs text-destructive">
                  {errors.text.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="simulate-image">图片（可选）</Label>
              <Input
                key={imageInputKey}
                id="simulate-image"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={submitting}
                aria-invalid={imageError ? true : undefined}
                onChange={(event) =>
                  onImageChange(event.currentTarget.files?.[0] ?? null)
                }
              />
              {imageError ? (
                <p className="text-xs text-destructive">{imageError}</p>
              ) : imageName ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  将附上 {imageName}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={onClearImage}
                  >
                    移除
                  </button>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  PNG / JPEG / GIF / WebP，不超过 1 MB；平台会按题目 C1
                  把它下载到本地并显示在时间线里。
                </p>
              )}
            </div>
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
            {submitting ? "推送中…" : "推送"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

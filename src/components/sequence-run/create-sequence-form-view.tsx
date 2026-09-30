// 新建序列表单：纯展示。name + steps 行（accountRole / text / delaySeconds），index 由行位置派生、只展示。
// RHF 的 register / errors / 行的增删 / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { EMPTY_STEP_ROW } from "./sequence-run-schema";
import type { CreateSequenceFormViewProps } from "./types";

const CONTROL_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function CreateSequenceFormView({
  register,
  errors,
  steps,
  submitting,
  onSubmit,
}: CreateSequenceFormViewProps) {
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sequence-name">名称</Label>
        <Input
          id="sequence-name"
          placeholder="例如：发布会提醒"
          disabled={submitting}
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <fieldset className="flex flex-col gap-2" disabled={submitting}>
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">步骤</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => steps.append(EMPTY_STEP_ROW)}
          >
            <Plus className="size-4" />
            加一步
          </Button>
        </div>
        <FieldError
          message={errors.steps?.root?.message ?? errors.steps?.message}
        />
        {steps.fields.map((field, i) => {
          const rowError = errors.steps?.[i];

          return (
            <div
              key={field.id}
              className="grid grid-cols-[auto_auto_1fr_auto_auto] items-start gap-2"
            >
              <span className="pt-2 text-sm tabular-nums text-muted-foreground">
                #{i + 1}
              </span>
              <select
                aria-label={`第 ${i + 1} 步的发送角色`}
                className={cn(CONTROL_CLASS, "h-9 w-auto")}
                {...register(`steps.${i}.accountRole`)}
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
              <div className="flex flex-col gap-1">
                <Input
                  aria-label={`第 ${i + 1} 步的文本`}
                  placeholder="文本，例如：{event} 将于 {time} 开始"
                  aria-invalid={rowError?.text ? true : undefined}
                  {...register(`steps.${i}.text`)}
                />
                <FieldError message={rowError?.text?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`第 ${i + 1} 步的延迟秒数`}
                  className="w-24"
                  aria-invalid={rowError?.delaySeconds ? true : undefined}
                  {...register(`steps.${i}.delaySeconds`)}
                />
                <FieldError message={rowError?.delaySeconds?.message} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="删除这一步"
                disabled={steps.fields.length <= 1}
                onClick={() => steps.remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </fieldset>

      <Button
        type="submit"
        size="sm"
        className="self-end"
        disabled={submitting}
      >
        {submitting ? "创建中…" : "创建序列"}
      </Button>
    </form>
  );
}

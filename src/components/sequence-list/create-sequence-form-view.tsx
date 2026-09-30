// 新建序列表单：纯展示。name + steps 行（发送角色 / 文本 / 延迟秒数），index 由行位置派生、只展示。
// RHF 的 register / errors / 行的增删 / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 提交按钮在弹窗 footer（不在 <form> 里），用原生 form 属性关联（formId）。

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { EMPTY_STEP_ROW } from "./create-sequence-schema";
import type { CreateSequenceFormViewProps } from "./types";

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function CreateSequenceFormView({
  formId,
  register,
  errors,
  steps,
  submitting,
  onSubmit,
}: CreateSequenceFormViewProps) {
  return (
    <form
      id={formId}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={onSubmit}
    >
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

      <fieldset className="flex flex-col gap-3" disabled={submitting}>
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">步骤</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => steps.append(EMPTY_STEP_ROW)}
          >
            <Plus />
            加一步
          </Button>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">
          文本里用 {"{key}"} 占位，启动时按 vars / stepVars
          取值；延迟从上一步发出后算起。
        </p>
        <FieldError
          message={errors.steps?.root?.message ?? errors.steps?.message}
        />
        {steps.fields.map((field, i) => {
          const rowError = errors.steps?.[i];

          return (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                <NativeSelect
                  aria-label={`第 ${i + 1} 步的发送角色`}
                  size="sm"
                  {...register(`steps.${i}.accountRole`)}
                >
                  <NativeSelectOption value="admin">
                    管理员账号（admin）
                  </NativeSelectOption>
                  <NativeSelectOption value="member">
                    成员账号（member）
                  </NativeSelectOption>
                </NativeSelect>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  延迟
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={`第 ${i + 1} 步的延迟秒数`}
                    className="h-7 w-20"
                    aria-invalid={rowError?.delaySeconds ? true : undefined}
                    {...register(`steps.${i}.delaySeconds`)}
                  />
                  秒
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label="删除这一步"
                  disabled={steps.fields.length <= 1}
                  onClick={() => steps.remove(i)}
                >
                  <Trash2 />
                </Button>
              </div>
              <Input
                aria-label={`第 ${i + 1} 步的文本`}
                placeholder="文本，例如：{event} 将于 {time} 开始"
                className="bg-card"
                aria-invalid={rowError?.text ? true : undefined}
                {...register(`steps.${i}.text`)}
              />
              <FieldError message={rowError?.text?.message} />
              <FieldError message={rowError?.delaySeconds?.message} />
            </div>
          );
        })}
      </fieldset>
    </form>
  );
}

// 启动表单：纯展示。选序列（下拉）、vars 的 key-value 行、stepVars 的「步骤 + key-value」行；
// RHF 的 register / errors / 行的增删 / onSubmit 由 hook 给；校验权威只有 zod，所以 <form noValidate>。
// 后端 422 UNRESOLVED_PLACEHOLDER 时：顶部 Alert 写明 stepIndex 与 key，对应的行（vars 里同 key、
// stepVars 里同步同 key）高亮。提交只做本地预检并打开弹窗，真正的启动在弹窗 footer。

import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import type { SequenceFormViewProps } from "./types";

const HIGHLIGHT_ROW_CLASS =
  "rounded-md bg-destructive/10 ring-1 ring-destructive";

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function SequenceFormView({
  sequences,
  sequencesLoading,
  selectedSequenceId,
  selectedSteps,
  register,
  errors,
  vars,
  stepVars,
  serverUnresolved,
  disabledReason,
  onFillPlaceholders,
  onSubmit,
}: SequenceFormViewProps) {
  const disabled = disabledReason !== null;
  const noSequence = !sequencesLoading && sequences.length === 0;
  const hasSelection = selectedSteps.length > 0;

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
      {disabledReason ? (
        <p className="text-sm text-destructive">{disabledReason}</p>
      ) : null}

      {serverUnresolved ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>预检不通过（UNRESOLVED_PLACEHOLDER）</AlertTitle>
          <AlertDescription>
            <p>
              第 {serverUnresolved.stepIndex} 步的占位符{" "}
              <code className="font-mono">{`{${serverUnresolved.key}}`}</code>{" "}
              解析不到：在 vars 或第 {serverUnresolved.stepIndex} 步的 stepVars
              里提供 {serverUnresolved.key}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sequence-id">序列</Label>
        <NativeSelect
          id="sequence-id"
          className="w-full sm:max-w-md"
          disabled={disabled || sequencesLoading}
          aria-invalid={errors.sequenceId ? true : undefined}
          value={selectedSequenceId}
          {...register("sequenceId")}
        >
          <NativeSelectOption value="">
            {sequencesLoading
              ? "加载序列中…"
              : noSequence
                ? "还没有序列，先到「定时序列」页新建"
                : "请选择"}
          </NativeSelectOption>
          {sequences.map((sequence) => (
            <NativeSelectOption key={sequence.id} value={sequence.id}>
              {sequence.name}（{sequence.steps.length} 步）
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError message={errors.sequenceId?.message} />
        {hasSelection ? (
          <ol className="mt-1 flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {selectedSteps.map((step) => (
              <li key={step.index} className="flex gap-2">
                <span className="shrink-0 tabular-nums">#{step.index}</span>
                <span className="shrink-0">{step.accountRole}</span>
                <span className="shrink-0 tabular-nums">
                  +{step.delaySeconds}s
                </span>
                <span className="break-all">{step.text}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">vars（起始取值）</legend>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasSelection}
              onClick={onFillPlaceholders}
            >
              填入占位符
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => vars.append({ key: "", value: "" })}
            >
              <Plus className="size-4" />
              加一行
            </Button>
          </div>
        </div>
        {vars.fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            没有 vars；空字符串视为未提供
          </p>
        ) : null}
        {vars.fields.map((field, i) => {
          const rowError = errors.vars?.[i];
          const highlighted = serverUnresolved?.varRows.includes(i) ?? false;

          return (
            <div
              key={field.id}
              className={cn(
                "grid grid-cols-[1fr_2fr_auto] items-start gap-2 p-1",
                { [HIGHLIGHT_ROW_CLASS]: highlighted },
              )}
            >
              <div className="flex flex-col gap-1">
                <Input
                  aria-label={`vars 第 ${i + 1} 行的 key`}
                  placeholder="key"
                  className="font-mono"
                  aria-invalid={rowError?.key ? true : undefined}
                  {...register(`vars.${i}.key`)}
                />
                <FieldError message={rowError?.key?.message} />
              </div>
              <Input
                aria-label={`vars 第 ${i + 1} 行的 value`}
                placeholder="value（留空 = 未提供）"
                {...register(`vars.${i}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="删除这一行"
                onClick={() => vars.remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">stepVars（按步覆盖）</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasSelection}
            onClick={() =>
              stepVars.append({
                stepIndex: String(selectedSteps[0]?.index ?? 1),
                key: "",
                value: "",
              })
            }
          >
            <Plus className="size-4" />
            加一行
          </Button>
        </div>
        {stepVars.fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            没有
            stepVars；某步给了值就从该步起生效，直到更晚的步再给；空字符串表示这一步不改
          </p>
        ) : null}
        {stepVars.fields.map((field, i) => {
          const rowError = errors.stepVars?.[i];
          const highlighted =
            serverUnresolved?.stepVarRows.includes(i) ?? false;

          return (
            <div
              key={field.id}
              className={cn(
                "grid grid-cols-[auto_1fr_2fr_auto] items-start gap-2 p-1",
                { [HIGHLIGHT_ROW_CLASS]: highlighted },
              )}
            >
              <div className="flex flex-col gap-1">
                <NativeSelect
                  aria-label={`stepVars 第 ${i + 1} 行的步骤`}
                  aria-invalid={rowError?.stepIndex ? true : undefined}
                  {...register(`stepVars.${i}.stepIndex`)}
                >
                  {selectedSteps.map((step) => (
                    <NativeSelectOption
                      key={step.index}
                      value={String(step.index)}
                    >
                      第 {step.index} 步
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError message={rowError?.stepIndex?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  aria-label={`stepVars 第 ${i + 1} 行的 key`}
                  placeholder="key"
                  className="font-mono"
                  aria-invalid={rowError?.key ? true : undefined}
                  {...register(`stepVars.${i}.key`)}
                />
                <FieldError message={rowError?.key?.message} />
              </div>
              <Input
                aria-label={`stepVars 第 ${i + 1} 行的 value`}
                placeholder="value（留空 = 这一步不改）"
                {...register(`stepVars.${i}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="删除这一行"
                onClick={() => stepVars.remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </fieldset>

      <Button
        type="submit"
        className="self-end"
        disabled={disabled || noSequence}
      >
        预检
      </Button>
    </form>
  );
}

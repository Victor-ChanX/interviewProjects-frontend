// 可搜索下拉（Base UI Combobox）：输入框里打字筛选，选中一项即为值；可选「清空」。
// 选项是 { value, label }：显示 label，值是 value（Combobox.createItems），按 label 或 value 都能搜到。
// 选项较多（模型列表动辄几十个）时比原生 <select> 好用；值只能是列表里的一项，不接受自由输入。
// 受控：value 为空串表示未选；清空也回调空串。

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  placeholder?: string;
  /** 筛选后没有匹配项时的文案。 */
  emptyText?: string;
  disabled?: boolean;
  /** 显示清空按钮（可选字段用）。 */
  clearable?: boolean;
  invalid?: boolean;
  className?: string;
}

export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  emptyText = "没有匹配的选项",
  disabled = false,
  clearable = false,
  invalid = false,
  className,
}: SearchableSelectProps) {
  const { contains } = Combobox.useFilter();
  const items = useMemo(
    () =>
      Combobox.createItems([...options], {
        getValue: (option) => option.value,
        getLabel: (option) => option.label,
      }),
    [options],
  );

  return (
    <Combobox.Root
      items={items}
      filter={(option: SearchableSelectOption, query: string) =>
        contains(option.label, query) || contains(option.value, query)
      }
      value={value || null}
      // Combobox 在弹层关着时按 Esc、或把输入框删空，会把选中值清成 null；不可清空的字段不接受这种清空，
      // 否则一个手滑的 Esc 就把必选项清掉了（浏览器里实测踩到）。
      onValueChange={(next) => {
        if (next === null && !clearable) return;

        onValueChange(next ?? "");
      }}
      disabled={disabled}
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex h-9 w-full items-center rounded-md border border-input bg-background text-sm shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          {
            "border-destructive ring-destructive/20": invalid,
            "cursor-not-allowed opacity-50": disabled,
          },
          className,
        )}
      >
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          aria-invalid={invalid ? true : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <div className="flex h-full items-center pr-1 text-muted-foreground">
          {clearable && value ? (
            <Combobox.Clear
              aria-label="清空"
              className="flex size-7 items-center justify-center rounded-sm hover:text-foreground"
            >
              <X className="size-4" />
            </Combobox.Clear>
          ) : null}
          <Combobox.Trigger
            aria-label="展开选项"
            className="flex size-7 items-center justify-center rounded-sm hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
          <Combobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] rounded-md border border-border bg-card text-card-foreground shadow-md transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Combobox.Empty>
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {emptyText}
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-0 data-empty:p-0">
              {(option: SearchableSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-3 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 truncate">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

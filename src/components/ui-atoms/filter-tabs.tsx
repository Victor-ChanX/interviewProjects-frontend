// 列表顶部的筛选页签（全部 / 在线 / 限流 …）：Tabs 的页签条，只切筛选值、不带面板。可带计数；窄屏横向滚动。
// 值由调用方受控（通常存 URL，nuqs）。

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface FilterTabOption<T extends string> {
  value: T;
  label: string;
  /** 计数（不给不显示）。 */
  count?: number;
}

export interface FilterTabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly FilterTabOption<T>[];
  className?: string;
  "aria-label"?: string;
}

export function FilterTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: FilterTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={cn("max-w-full min-w-0", className)}
    >
      <div className="no-scrollbar max-w-full overflow-x-auto">
        <TabsList aria-label={ariaLabel}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="flex-none px-2.5"
            >
              {option.label}
              {option.count !== undefined ? (
                <span className="rounded-full bg-foreground/5 px-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                  {option.count}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

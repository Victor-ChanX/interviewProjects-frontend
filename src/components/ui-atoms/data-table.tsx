// （useTable + tableFeatures，只注册列显示；排序 / 分页在后端或 hook 里做，不进 table 状态 —— table.no-row-features）、
// 边框容器、表头底色、横向滚动、加载骨架、空态、「列显示」下拉、行单击 / 高亮与行下方的内联明细行。
//
// feature 只声明列：用本文件导出的 dataTableColumnHelper<Row>() 建列，列名与列宽写进 columnMeta（{ label, className }）。
// 不给 label 的列不进「列显示」下拉（行操作列、展开列都不给）。列定义放模块顶层或 useMemo，别每次渲染新建。

import { type Row, type RowData, useTable } from "@tanstack/react-table";
import { Columns3, Inbox } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  type DataTableColumns,
  dataTableFeatures,
  type DataTableFeatures,
} from "./data-table-columns";

export interface DataTableProps<TData extends RowData> {
  columns: DataTableColumns<TData>;
  data: readonly TData[];
  /** 行的稳定 id（不给就按下标，实时插入会让展开 / 高亮错位）。 */
  getRowId: (row: TData) => string;
  loading?: boolean;
  /** 骨架行数。 */
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  /** 行单击（整行可点时给）；行内的按钮 / 链接要自己 stopPropagation。 */
  onRowClick?: (row: TData) => void;
  /** 行的附加样式（blocked 高亮、当前项强调……）。 */
  rowClassName?: (row: TData) => string | undefined;
  /** 选中行（data-state=selected 的底色）。 */
  selectedRowId?: string | null;
  /** 行下方的内联明细行：返回 null 就不渲染（例如只有展开的那几行才有）。 */
  renderSubRow?: (row: TData) => ReactNode;
  /** 表格上方工具条左侧（筛选、说明）；右侧固定是「列显示」下拉。 */
  toolbar?: ReactNode;
  /** 表格下方（「加载更多」按钮这类）。 */
  footer?: ReactNode;
  /** 默认隐藏的列（列 id → false）。 */
  initialHiddenColumns?: readonly string[];
  /** 端到端测试挂在 <table> 上的 data-testid。 */
  testId?: string;
  className?: string;
}

function hiddenState(ids: readonly string[] | undefined) {
  return Object.fromEntries((ids ?? []).map((id) => [id, false]));
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "暂无数据",
  emptyDescription,
  onRowClick,
  rowClassName,
  selectedRowId,
  renderSubRow,
  toolbar,
  footer,
  initialHiddenColumns,
  testId,
  className,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    // react-table 的 data 是可变数组类型；这里不改它，只读传入即可。
    data: data as TData[],
    getRowId: (row) => getRowId(row),
    initialState: { columnVisibility: hiddenState(initialHiddenColumns) },
  });

  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.label && column.getCanHide());
  const visibleCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;

  const renderRow = (row: Row<DataTableFeatures, TData>) => {
    const original = row.original;
    const sub = renderSubRow?.(original);

    return (
      <Fragment key={row.id}>
        <TableRow
          data-state={row.id === selectedRowId ? "selected" : undefined}
          className={cn(
            { "cursor-pointer": onRowClick },
            rowClassName?.(original),
          )}
          onClick={onRowClick ? () => onRowClick(original) : undefined}
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell
              key={cell.id}
              className={cn(
                "px-3 py-2.5",
                cell.column.columnDef.meta?.className,
              )}
            >
              <table.FlexRender cell={cell} />
            </TableCell>
          ))}
        </TableRow>
        {sub ? (
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={visibleCount} className="px-3 py-3">
              {sub}
            </TableCell>
          </TableRow>
        ) : null}
      </Fragment>
    );
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {toolbar || hideable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {toolbar}
          </div>
          {hideable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                <Columns3 />
                列显示
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>显示的列</DropdownMenuLabel>
                  {hideable.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(value)
                      }
                    >
                      {column.columnDef.meta?.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table data-testid={testId}>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-10 px-3 text-xs font-medium text-muted-foreground",
                      header.column.columnDef.meta?.className,
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              Array.from({ length: skeletonRows }, (_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="hover:bg-transparent"
                >
                  {Array.from({ length: visibleCount }, (_, j) => (
                    <TableCell key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleCount} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-1.5 text-center whitespace-normal">
                    <Inbox className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    {emptyDescription ? (
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {emptyDescription}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map(renderRow)
            )}
          </TableBody>
        </Table>
      </div>

      {footer}
    </div>
  );
}

// 共享 DataTable 的列定义工具（组件在 ./data-table.tsx；分开放是因为 Vite 的 Fast Refresh 要求组件文件只导出组件）。
// feature 用 dataTableColumnHelper<Row>() 建列，列名与列宽写进 columnMeta（{ label, className }）。

import {
  columnVisibilityFeature,
  createColumnHelper,
  metaHelper,
  type RowData,
  type TableOptions,
  tableFeatures,
} from "@tanstack/react-table";

export interface DataTableColumnMeta {
  /** 表头文字，同时是「列显示」下拉里的名字；不给就不进下拉。 */
  label?: string;
  /** 表头与单元格共用的类（列宽、对齐、等宽字体……）。 */
  className?: string;
}

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** 列定义工具：`const col = dataTableColumnHelper<Row>(); const columns = col.columns([...])`。 */
export function dataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

export type DataTableColumns<TData extends RowData> = TableOptions<
  DataTableFeatures,
  TData
>["columns"];

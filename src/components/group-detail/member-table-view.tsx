// 成员表：DataTable（平台用户 ID / 角色 / 服务账号）。外部用户没有服务账号。纯展示。

import { DataTable } from "@/components/ui-atoms/data-table";
import { dataTableColumnHelper } from "@/components/ui-atoms/data-table-columns";
import { StatusBadge } from "@/components/ui-atoms/status-badge";
import { MEMBER_ROLE_LABELS, MEMBER_ROLE_TONE } from "@/lib/group-labels";
import type { GroupMemberRead } from "@/services/group-service";

import type { MemberTableViewProps } from "./types";

const col = dataTableColumnHelper<GroupMemberRead>();

const COLUMNS = col.columns([
  col.accessor("platformUserId", {
    header: "平台用户 ID",
    meta: { label: "平台用户 ID" },
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.platformUserId}</span>
    ),
  }),
  col.accessor("role", {
    header: "角色",
    meta: { label: "角色", className: "w-28" },
    cell: ({ row }) => (
      <StatusBadge tone={MEMBER_ROLE_TONE[row.original.role]} dot={false}>
        {MEMBER_ROLE_LABELS[row.original.role]}
      </StatusBadge>
    ),
  }),
  col.accessor("accountId", {
    header: "服务账号",
    meta: { label: "服务账号", className: "w-40" },
    cell: ({ row }) =>
      row.original.accountId ? (
        <span className="font-mono text-xs">{row.original.accountId}</span>
      ) : (
        <span className="text-muted-foreground">外部用户</span>
      ),
  }),
]);

export function MemberTableView({ members }: MemberTableViewProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={members}
      getRowId={(member) => member.platformUserId}
      emptyTitle="暂无成员"
      emptyDescription="全部退群后成员表会清空。"
      testId="member-table"
    />
  );
}

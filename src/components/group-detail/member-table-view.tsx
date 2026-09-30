// 成员表：纯展示。原生 <table>：共享 DataTable（ui-atoms）尚未落地，三列只读表不值得先造它。

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/services/group-service";

import type { MemberTableViewProps } from "./types";

const ROLE_LABELS: Readonly<Record<MemberRole, string>> = {
  creator: "群主",
  admin: "管理员",
  member: "成员",
};

/** 角色 → 徽标样式：全部走主题 token。 */
const ROLE_BADGE_CLASS: Readonly<Record<MemberRole, string>> = {
  creator: "border-primary/40 bg-primary/10 text-primary",
  admin: "border-warning/40 bg-warning/15 text-warning",
  member: "border-border bg-muted text-muted-foreground",
};

const HEADERS = ["平台用户 ID", "角色", "服务账号"] as const;

export function MemberTableView({ members }: MemberTableViewProps) {
  if (members.length === 0)
    return <p className="text-sm text-muted-foreground">暂无成员</p>;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.platformUserId}>
              <td className="px-3 py-2 font-mono text-xs">
                {member.platformUserId}
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={cn("font-medium", ROLE_BADGE_CLASS[member.role])}
                >
                  {ROLE_LABELS[member.role]}
                </Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {member.accountId ?? (
                  <span className="font-sans text-muted-foreground">
                    外部用户
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

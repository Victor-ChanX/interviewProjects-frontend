import type { FormEvent } from "react";

import type { JobProgressProps } from "@/components/ui-atoms/job-progress";
import type { GroupRead } from "@/services/group-service";

/** 新建群可选的账号：status 为 online 的服务账号（由 hook 过滤好）。 */
export interface CreateGroupAccountOption {
  id: string;
  platformUserId: string | null;
}

export interface CreateGroupDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: CreateGroupAccountOption[];
  accountsLoading: boolean;
  accountsError: string | null;
  creatorAccountId: string;
  /** 勾选顺序；第一个会被提升为管理员。 */
  memberAccountIds: string[];
  errors: { creatorAccountId: string | null; memberAccountIds: string | null };
  onCreatorChange: (id: string) => void;
  onToggleMember: (id: string) => void;
  submitting: boolean;
  /** 提交被拒的整句提示（422 ACCOUNT_NOT_ONLINE / 400 VALIDATION_ERROR 的 message）；null 不显示。 */
  submitError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** 已拿到 jobId 时切到进度；null 表示还在填表。 */
  progress: (JobProgressProps & { running: boolean }) | null;
}

export interface GroupListViewProps {
  groups: GroupRead[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
  /** admin 才有「新建群」入口；viewer 为 null。 */
  createDialog: CreateGroupDialogViewProps | null;
  onCreate: () => void;
}

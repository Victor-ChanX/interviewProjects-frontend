// container：hook 编排 + 路由跳转 + 权限分支；渲染就绪的数据与回调通过 props 交给 view。
// 新建群（前端 #10）只给 admin：弹窗的表单 / 提交 / 进度都在 use-create-group；账号状态事件复用
// src/hooks/use-account-events.ts，让弹窗里的「在线账号」跟着变。

import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";

import { useAccountEvents } from "@/hooks/use-account-events";
import { useSession } from "@/hooks/use-session";

import { GroupListView } from "./group-list-view";
import type { CreateGroupDialogViewProps } from "./types";
import { useCreateGroup } from "./use-create-group";
import { useGroupList } from "./use-group-list";

export function GroupListContainer() {
  const navigate = useNavigate();
  const canWrite = useSession()?.canWrite ?? false;
  const list = useGroupList();
  const create = useCreateGroup({ enabled: canWrite });
  const { refetch } = list;

  useAccountEvents();

  const onOpen = useCallback(
    (id: string) => {
      void navigate(`/groups/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const createDialog = useMemo<CreateGroupDialogViewProps | null>(
    () =>
      canWrite
        ? {
            open: create.open,
            onOpenChange: create.setOpen,
            accounts: create.accounts,
            accountsLoading: create.accountsLoading,
            accountsError: create.accountsError,
            creatorAccountId: create.creatorAccountId,
            memberAccountIds: create.memberAccountIds,
            errors: create.errors,
            onCreatorChange: create.changeCreator,
            onToggleMember: create.changeMember,
            submitting: create.submitting,
            submitError: create.submitError,
            onSubmit: create.submit,
            progress:
              create.jobId === null
                ? null
                : {
                    job: create.job,
                    errorMessage: create.jobError,
                    running: create.jobRunning,
                  },
          }
        : null,
    [canWrite, create],
  );

  return (
    <GroupListView
      groups={list.groups}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      onRetry={onRetry}
      onOpen={onOpen}
      createDialog={createDialog}
      onCreate={create.openDialog}
    />
  );
}

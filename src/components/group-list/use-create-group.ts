// 新建群这一条业务流（前端 #10）：打开弹窗 → 选群主（online 账号）与成员（online 且不含群主，勾选顺序即
// 提交顺序，第一个会被提升为管理员）→ POST /api/groups → 202 { jobId } → 弹窗切到进度（use-job-progress：
// 轮询 + WS job 事件）→ finished：toast 并跳到 /groups/:groupId；failed：弹窗里列出 errors[]，可关闭。
// 422 ACCOUNT_NOT_ONLINE / 400 VALIDATION_ERROR 显示后端的整句 message（mutation.error 派生，留在弹窗里）。
// 关弹窗不取消 job（后端照常跑，群列表随 WS job 事件刷新）；下次打开才清掉上一次的表单与进度
// （Base UI 的浮层关闭后还在淡出，关的时候清会闪）。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useController, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useJobProgress } from "@/hooks/use-job-progress";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { listAccounts } from "@/services/account-service";
import { createGroup } from "@/services/group-service";
import type { JobRead } from "@/services/job-service";

import {
  type CreateGroupFormValues,
  createGroupSchema,
  EMPTY_CREATE_GROUP_FORM,
  toggleMember,
} from "./create-group-schema";
import type { CreateGroupAccountOption } from "./types";

export interface UseCreateGroupOptions {
  /** viewer 没有入口，也不拉账号列表。 */
  enabled: boolean;
}

export function useCreateGroup({ enabled }: UseCreateGroupOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: listAccounts,
    enabled: enabled && open,
  });

  const accounts = useMemo<CreateGroupAccountOption[]>(
    () =>
      (accountsQuery.data ?? [])
        .filter((account) => account.status === "online")
        .map((account) => ({
          id: account.id,
          platformUserId: account.platformUserId,
        })),
    [accountsQuery.data],
  );

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: EMPTY_CREATE_GROUP_FORM,
  });
  const { control, handleSubmit, reset } = form;
  // 两个字段都不走 register（下拉由 view 受控、成员是勾选列表），用 useController 登记：值与提交后的
  // 重新校验都走 RHF，view 拿到的是受控值。
  const creator = useController({ control, name: "creatorAccountId" });
  const members = useController({ control, name: "memberAccountIds" });
  const creatorAccountId = creator.field.value;
  const memberAccountIds = members.field.value;
  const { onChange: setCreator } = creator.field;
  const { onChange: setMembers } = members.field;

  const mutation = useMutation({ mutationFn: createGroup });
  const { mutateAsync, reset: resetMutation } = mutation;

  const onSettled = useCallback(
    (job: JobRead) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });

      if (job.status !== "finished") return;

      toast.success("群已创建");
      setOpen(false);

      if (job.groupId)
        void navigate(`/groups/${encodeURIComponent(job.groupId)}`);
    },
    [navigate, queryClient],
  );

  const progress = useJobProgress(jobId, { onSettled });

  const openDialog = useCallback(() => {
    reset(EMPTY_CREATE_GROUP_FORM);
    resetMutation();
    setJobId(null);
    setOpen(true);
  }, [reset, resetMutation]);

  /** 换群主：新群主若已在成员里就移出（成员不能含群主）。 */
  const changeCreator = useCallback(
    (id: string) => {
      setCreator(id);
      setMembers(memberAccountIds.filter((member) => member !== id));
    },
    [memberAccountIds, setCreator, setMembers],
  );

  const changeMember = useCallback(
    (id: string) => {
      setMembers(toggleMember(memberAccountIds, id));
    },
    [memberAccountIds, setMembers],
  );

  const onValid = useCallback(
    async (values: CreateGroupFormValues) => {
      try {
        const { jobId: started } = await mutateAsync(values);

        setJobId(started);
      } catch {
        // 422 / 400 的整句提示由 mutation.error 派生，在弹窗里展示。
      }
    },
    [mutateAsync],
  );

  const { errors } = form.formState;

  return {
    open,
    openDialog,
    setOpen,
    accounts,
    accountsLoading: accountsQuery.isPending && enabled && open,
    accountsError: accountsQuery.error
      ? getErrorMessage(accountsQuery.error, "账号列表加载失败")
      : null,
    creatorAccountId,
    memberAccountIds,
    errors: {
      creatorAccountId: errors.creatorAccountId?.message ?? null,
      memberAccountIds: errors.memberAccountIds?.message ?? null,
    },
    changeCreator,
    changeMember,
    submit: handleSubmit(onValid),
    submitting: mutation.isPending,
    submitError: mutation.error
      ? getErrorMessage(mutation.error, "建群失败，请重试")
      : null,
    jobId,
    job: progress.job,
    jobRunning: progress.running,
    jobError: progress.error
      ? getErrorMessage(progress.error, "查询进度失败")
      : null,
  };
}

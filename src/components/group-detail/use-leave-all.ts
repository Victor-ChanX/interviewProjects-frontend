// 全部退群这一条业务流（前端 #10）：确认弹窗 → POST /api/groups/:id/leave-all → 202 { jobId } → 弹窗切到进度
// （use-job-progress：轮询 + WS job 事件）→ 终态刷新群详情与群列表：finished 时群已是 left、成员表清空，
// toast 并关弹窗；failed 时弹窗里列出 errors[]（群主没退，失败账号仍是成员），可关闭。
// 409 GROUP_ALREADY_LEFT / GROUP_NOT_READY / JOB_ALREADY_RUNNING 显示后端的整句 message（mutation.error 派生）。
// 关弹窗不取消 job；下次打开才清掉上一次的进度（Base UI 的浮层关闭后还在淡出，关的时候清会闪）。

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useJobProgress } from "@/hooks/use-job-progress";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { leaveAllGroup } from "@/services/group-service";
import type { JobRead } from "@/services/job-service";

export function useLeaveAll(groupId: string) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const mutation = useMutation({ mutationFn: () => leaveAllGroup(groupId) });
  const { mutateAsync, reset: resetMutation } = mutation;

  const onSettled = useCallback(
    (job: JobRead) => {
      // 两种终态都要重拉：failed 时也可能已有部分账号退了。群列表的状态 / 成员数同样变了。
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });

      if (job.status !== "finished") return;

      toast.success("已全部退群");
      setOpen(false);
    },
    [queryClient],
  );

  const progress = useJobProgress(jobId, { onSettled });

  const openDialog = useCallback(() => {
    resetMutation();
    setJobId(null);
    setOpen(true);
  }, [resetMutation]);

  const confirm = useCallback(async () => {
    try {
      const { jobId: started } = await mutateAsync();

      setJobId(started);
    } catch {
      // 409 的整句提示由 mutation.error 派生，在弹窗里展示。
    }
  }, [mutateAsync]);

  return {
    open,
    openDialog,
    setOpen,
    confirm,
    submitting: mutation.isPending,
    submitError: mutation.error
      ? getErrorMessage(mutation.error, "全部退群失败，请重试")
      : null,
    jobId,
    job: progress.job,
    jobRunning: progress.running,
    jobError: progress.error
      ? getErrorMessage(progress.error, "查询进度失败")
      : null,
  };
}

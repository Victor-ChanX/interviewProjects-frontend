// 删除已退出的群（前端 #25，后端 #62）：确认弹窗 → DELETE /api/groups/:id → toast、回到群列表、刷新列表。
// 不手动 removeQueries 这个群的详情 / 时间线：详情页在导航提交前还挂着，清掉它的缓存会让还在的观察者立刻按 id 重拉、
// 拿回 404 并弹「群不存在」；离开页面后没人观察，缓存按 gcTime 自己回收。也只刷新群列表（groups.list），不刷 groups.all。
// 409（还没退出 / 还有进行中的任务）显示后端的整句提示，弹窗留着。

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { deleteGroup } from "@/services/group-service";

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({ mutationFn: () => deleteGroup(groupId) });
  const { mutateAsync } = mutation;

  const confirm = useCallback(async () => {
    try {
      const result = await mutateAsync();

      setOpen(false);
      await navigate("/groups", { replace: true });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.groups.list(),
      });
      toast.success(`群已删除（${result.messagesDeleted} 条消息一并删除）`);
    } catch (error) {
      toast.error(getErrorMessage(error, "删除失败，请重试"));
    }
  }, [mutateAsync, navigate, queryClient]);

  return {
    open,
    setOpen,
    confirm,
    deleting: mutation.isPending,
  };
}

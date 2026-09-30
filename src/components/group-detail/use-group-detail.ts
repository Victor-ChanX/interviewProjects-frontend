// 群详情这一条业务流：GET /api/groups/:id → 缓存；开关走 PATCH（mutateAsync 由容器包 try/catch + toast）；
// 本群的实时事件回写缓存：group_settings_changed 就地改开关，member_changed / group_status_changed /
// agent_run（activeAgentRunId 变了）按 key invalidate。事件只带 id 与变化，不是整行实体，所以除开关外都重拉。

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import type {
  AgentRunEventPayload,
  GroupSettingsChangedEventPayload,
  GroupStatusChangedEventPayload,
  MemberChangedEventPayload,
} from "@/lib/ws";
import {
  getGroup,
  type GroupRead,
  patchGroup,
  type PatchGroupPayload,
} from "@/services/group-service";

import type { GroupSetting } from "./types";

export function useGroupDetail(groupId: string) {
  const queryClient = useQueryClient();
  const [savingSetting, setSavingSetting] = useState<GroupSetting | null>(null);

  const query = useQuery({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: () => getGroup(groupId),
    // 主查询：404 / 失败由 view 渲染错误卡，不再弹 toast。
    meta: { silent: true },
  });

  const mutation = useMutation({
    mutationFn: (patch: PatchGroupPayload) => patchGroup(groupId, patch),
  });
  const { mutateAsync } = mutation;

  const invalidateDetail = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.groups.detail(groupId),
    });
  }, [groupId, queryClient]);

  useRealtimeEvent<GroupSettingsChangedEventPayload>(
    "group_settings_changed",
    useCallback(
      (payload) => {
        if (payload.groupId !== groupId) return;

        queryClient.setQueryData<GroupRead>(
          queryKeys.groups.detail(groupId),
          (old) =>
            old
              ? {
                  ...old,
                  agentEnabled: payload.agentEnabled,
                  autoKickEnabled: payload.autoKickEnabled,
                }
              : old,
        );
      },
      [groupId, queryClient],
    ),
  );

  useRealtimeEvent<GroupStatusChangedEventPayload>(
    "group_status_changed",
    useCallback(
      (payload) => {
        if (payload.groupId !== groupId) return;

        queryClient.setQueryData<GroupRead>(
          queryKeys.groups.detail(groupId),
          (old) => (old ? { ...old, status: payload.to } : old),
        );
        // 群列表里的状态列也变了。
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      },
      [groupId, queryClient],
    ),
  );

  useRealtimeEvent<MemberChangedEventPayload>(
    "member_changed",
    useCallback(
      (payload) => {
        if (payload.groupId === groupId) invalidateDetail();
      },
      [groupId, invalidateDetail],
    ),
  );

  useRealtimeEvent<AgentRunEventPayload>(
    "agent_run",
    useCallback(
      (payload) => {
        if (payload.groupId === groupId) invalidateDetail();
      },
      [groupId, invalidateDetail],
    ),
  );

  /** 改一个开关；成功后用响应（权威的整行）覆盖缓存。抛错交给容器 toast。 */
  const toggleSetting = useCallback(
    async (setting: GroupSetting, value: boolean) => {
      setSavingSetting(setting);

      try {
        const next = await mutateAsync({ [setting]: value });

        queryClient.setQueryData<GroupRead>(
          queryKeys.groups.detail(groupId),
          next,
        );
      } finally {
        setSavingSetting(null);
      }
    },
    [groupId, mutateAsync, queryClient],
  );

  return {
    group: query.data,
    loading: query.isPending && !query.data,
    error: query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
    savingSetting,
    toggleSetting,
  };
}

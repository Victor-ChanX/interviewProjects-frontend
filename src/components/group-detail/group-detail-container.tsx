// container：hook 编排 + 权限分支 + 开关的 toast；渲染就绪的数据与回调通过 props 交给 view。
// 实时订阅都在各自的 hook 里（use-group-detail / use-message-timeline / use-agent-runs）；
// 账号状态事件复用 src/hooks/use-account-events.ts，让发消息表单的「在线账号」跟着变。
// 全部退群（前端 #10）只给 admin：确认 / 提交 / 进度在 use-leave-all。

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useAccountEvents } from "@/hooks/use-account-events";
import { useSession } from "@/hooks/use-session";
import { getErrorMessage } from "@/lib/get-error-message";
import type { GroupMemberRead, GroupStatus } from "@/services/group-service";

import { GroupDetailView } from "./group-detail-view";
import type { GroupTab } from "./group-tabs";
import type {
  GroupSetting,
  LeaveAllDialogViewProps,
  SendMessageFormViewProps,
} from "./types";
import { useAgentRuns } from "./use-agent-runs";
import { useGroupDetail } from "./use-group-detail";
import { useGroupTab } from "./use-group-tab";
import { useLeaveAll } from "./use-leave-all";
import { useMessageTimeline } from "./use-message-timeline";
import { useSendMessage } from "./use-send-message";
import { useSenderNames } from "./use-sender-names";

const SETTING_TOAST: Readonly<Record<GroupSetting, string>> = {
  agentEnabled: "Agent 自动回复",
  autoKickEnabled: "自动踢人",
};

const WRITE_BLOCKED_REASON: Readonly<Record<GroupStatus, string | null>> = {
  active: null,
  unreachable: "群不可达，暂时不能发消息",
  left: "服务账号已退群，不能发消息",
};

const NO_MEMBERS: GroupMemberRead[] = [];

export function GroupDetailContainer({ groupId }: { groupId: string }) {
  const canWrite = useSession()?.canWrite ?? false;
  const [tab, setTab] = useGroupTab();
  const detail = useGroupDetail(groupId);
  const timeline = useMessageTimeline(groupId);
  const senderNames = useSenderNames();
  const agentRuns = useAgentRuns(groupId);
  const members = detail.group?.members ?? NO_MEMBERS;
  const send = useSendMessage({ groupId, members, enabled: canWrite });
  const leave = useLeaveAll(groupId);
  const { toggleSetting, refetch: refetchDetail } = detail;
  const { refetch: refetchTimeline } = timeline;
  const { refetch: refetchAgentRuns } = agentRuns;

  useAccountEvents();

  const onToggleSetting = useCallback(
    async (setting: GroupSetting, value: boolean) => {
      try {
        await toggleSetting(setting, value);
        toast.success(`${SETTING_TOAST[setting]}已${value ? "开启" : "关闭"}`);
      } catch (error) {
        toast.error(getErrorMessage(error, "保存失败，请重试"));
      }
    },
    [toggleSetting],
  );

  const onTabChange = useCallback(
    (next: GroupTab) => {
      void setTab(next === "messages" ? null : next);
    },
    [setTab],
  );

  const onRetry = useCallback(() => {
    void refetchDetail();
  }, [refetchDetail]);

  const onTimelineRetry = useCallback(() => {
    void refetchTimeline();
  }, [refetchTimeline]);

  const onAgentRunsRetry = useCallback(() => {
    void refetchAgentRuns();
  }, [refetchAgentRuns]);

  const sendForm = useMemo<SendMessageFormViewProps | null>(
    () =>
      canWrite
        ? {
            accounts: send.accounts,
            accountsLoading: send.accountsLoading,
            register: send.register,
            errors: send.errors,
            sending: send.sending,
            disabledReason: detail.group
              ? WRITE_BLOCKED_REASON[detail.group.status]
              : null,
            onSubmit: send.submit,
          }
        : null,
    [canWrite, detail.group, send],
  );

  const leaveAll = useMemo<LeaveAllDialogViewProps | null>(
    () =>
      canWrite
        ? {
            open: leave.open,
            onOpenChange: leave.setOpen,
            groupId,
            submitting: leave.submitting,
            submitError: leave.submitError,
            onConfirm: () => void leave.confirm(),
            progress:
              leave.jobId === null
                ? null
                : {
                    job: leave.job,
                    errorMessage: leave.jobError,
                    running: leave.jobRunning,
                  },
          }
        : null,
    [canWrite, groupId, leave],
  );

  return (
    <GroupDetailView
      group={detail.group}
      loading={detail.loading}
      error={detail.error}
      retrying={detail.retrying}
      onRetry={onRetry}
      tab={tab}
      onTabChange={onTabChange}
      canWrite={canWrite}
      savingSetting={detail.savingSetting}
      onToggleSetting={onToggleSetting}
      members={{ members }}
      timeline={{
        messages: timeline.messages,
        senderNames,
        loading: timeline.loading,
        error: timeline.error,
        retrying: timeline.retrying,
        hasMore: timeline.hasMore,
        loadingMore: timeline.loadingMore,
        onLoadMore: timeline.loadMore,
        onRetry: onTimelineRetry,
      }}
      sendForm={sendForm}
      agentRuns={{
        runs: agentRuns.runs,
        loading: agentRuns.loading,
        error: agentRuns.error,
        retrying: agentRuns.retrying,
        activeRunId: detail.group?.activeAgentRunId ?? null,
        onRetry: onAgentRunsRetry,
      }}
      leaveAll={leaveAll}
      onLeaveAll={leave.openDialog}
    />
  );
}

// container：hook 编排 + 权限分支；渲染就绪的数据与回调通过 props 交给 view。
// 业务流（预检 / 启动 / 422 与 409 的处理 / 实时订阅）都在 use-sequence-run；这里只把 hook 输出拼成 view 的 props。
// 新建序列在「定时序列」页（前端 #12）；从那里「在群启动」进来时带 ?sequenceId=，表单初始选中它。

import { useCallback, useMemo } from "react";

import { useSession } from "@/hooks/use-session";
import { groupDisplayName } from "@/lib/short-id";

import { SequenceRunView } from "./sequence-run-view";
import type {
  SequenceFormViewProps,
  SequenceRunProgressViewProps,
} from "./types";
import { useSequenceRun } from "./use-sequence-run";

export function SequenceRunContainer({
  groupId,
  initialSequenceId,
}: {
  groupId: string;
  initialSequenceId?: string;
}) {
  const canWrite = useSession()?.canWrite ?? false;
  const state = useSequenceRun({
    groupId,
    enabled: canWrite,
    initialSequenceId,
  });
  const { refetchGroup, refetchRun } = state;

  const onGroupRetry = useCallback(() => {
    void refetchGroup();
  }, [refetchGroup]);

  const onRunRetry = useCallback(() => {
    void refetchRun();
  }, [refetchRun]);

  const form = useMemo<SequenceFormViewProps | null>(
    () =>
      canWrite
        ? {
            sequences: state.sequences,
            sequencesLoading: state.sequencesLoading,
            selectedSequenceId: state.selectedSequenceId,
            selectedSteps: state.selectedSteps,
            register: state.register,
            errors: state.errors,
            vars: state.vars,
            stepVars: state.stepVars,
            serverUnresolved: state.serverUnresolved,
            disabledReason: state.disabledReason,
            onFillPlaceholders: state.fillPlaceholders,
            onSubmit: state.submit,
          }
        : null,
    [
      canWrite,
      state.disabledReason,
      state.errors,
      state.fillPlaceholders,
      state.register,
      state.selectedSequenceId,
      state.selectedSteps,
      state.sequences,
      state.sequencesLoading,
      state.serverUnresolved,
      state.stepVars,
      state.submit,
      state.vars,
    ],
  );

  const progress = useMemo<SequenceRunProgressViewProps | null>(
    () =>
      state.runId
        ? {
            run: state.run,
            loading: state.runLoading,
            error: state.runError,
            retrying: state.runRetrying,
            onRetry: onRunRetry,
          }
        : null,
    [
      onRunRetry,
      state.run,
      state.runError,
      state.runId,
      state.runLoading,
      state.runRetrying,
    ],
  );

  return (
    <SequenceRunView
      groupId={groupId}
      groupName={state.group ? groupDisplayName(state.group) : ""}
      groupLoading={state.groupLoading}
      groupError={state.groupError}
      groupRetrying={state.groupRetrying}
      onGroupRetry={onGroupRetry}
      form={form}
      preflight={{
        open: state.preflightOpen,
        result: state.preflightResult,
        starting: state.starting,
        onOpenChange: state.setPreflightOpen,
        onConfirm: state.confirmStart,
      }}
      progress={progress}
    />
  );
}

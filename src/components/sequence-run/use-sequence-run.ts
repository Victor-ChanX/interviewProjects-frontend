// 序列运行这一条业务流（题目第 4 节页面 5；前端 #6）：
// 选序列、填 vars / stepVars（RHF + zod）→ 本地预检（src/lib/sequence-vars.ts 复现后端 resolveVars 的取值规则，
// 弹窗展示每步每个 key 的最终取值与来源；本地解析不到就不调后端）→ POST /api/groups/:id/sequence-runs →
// 201 { runId } 后展示该 run 的进度（GET /api/sequence-runs/:id）。
// - 422 UNRESOLVED_PLACEHOLDER：从信封取 { stepIndex, key } 给表单高亮并 toast；409 SEQUENCE_ALREADY_RUNNING：toast。
// - 群里已有进行中的序列（GroupRead.activeSequenceRunId）时直接展示它的进度。
// - 实时：WS `sequence_run` 事件只带 { runId, groupId, status, currentStepIndex }，不是整行，所以本群的事件按
//   runId invalidate 重拉（群详情的 activeSequenceRunId 也随之变）；running 期间再按固定间隔轮询兜底
//   （api.params-in-key：轮询用 refetchInterval，不用 useEffect）。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import {
  collectPlaceholders,
  type ResolveSequenceVarsResult,
  resolveSequenceVars,
} from "@/lib/sequence-vars";
import { getGroup, type GroupStatus } from "@/services/group-service";
import {
  getSequenceRun,
  getUnresolvedPlaceholder,
  isSequenceAlreadyRunning,
  listSequences,
  type SequenceRunEventPayload,
  type SequenceStepDefinition,
  type StartSequenceRunPayload,
  startSequenceRun,
} from "@/services/sequence-service";

import {
  EMPTY_START_FORM,
  type StartSequenceRunFormValues,
  startSequenceRunSchema,
  toStartSequenceRunPayload,
} from "./sequence-run-schema";
import type { ServerUnresolved } from "./types";

/** running 的 run 每隔这么久重拉一次步骤（事件只在状态变化时发，步骤排期靠这个跟上）。 */
export const RUNNING_POLL_MS = 2_000;

export const ALREADY_RUNNING_MESSAGE = "已有运行中的序列";

const WRITE_BLOCKED_REASON: Readonly<Record<GroupStatus, string | null>> = {
  active: null,
  unreachable: "群不可达，不能启动序列",
  left: "服务账号已退群，不能启动序列",
};

const NO_STEPS: SequenceStepDefinition[] = [];

interface PreflightState {
  result: ResolveSequenceVarsResult;
  payload: StartSequenceRunPayload;
}

export interface UseSequenceRunOptions {
  groupId: string;
  /** viewer 不渲染表单，也不拉序列列表。 */
  enabled: boolean;
  /** 从定时序列页「在群启动」进来时带的序列 id（URL `?sequenceId=`）：表单初始就选中它。 */
  initialSequenceId?: string;
}

export function useSequenceRun({
  groupId,
  enabled,
  initialSequenceId = "",
}: UseSequenceRunOptions) {
  const queryClient = useQueryClient();
  // 刚启动的 run：群详情的 activeSequenceRunId 在 run 结束后会变回 null，本页仍要继续展示它。
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  // 关只切 open，result 留到下次打开再覆盖：Base UI 的浮层关闭后节点还在淡出，清掉会让表格闪空。
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflight, setPreflight] = useState<PreflightState | null>(null);
  const [serverUnresolved, setServerUnresolved] =
    useState<ServerUnresolved | null>(null);

  const groupQuery = useQuery({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: () => getGroup(groupId),
    // 主查询：404 / 失败由 view 渲染错误卡，不再弹 toast。
    meta: { silent: true },
  });

  const sequencesQuery = useQuery({
    queryKey: queryKeys.sequences.list(),
    queryFn: listSequences,
    enabled,
  });

  const runId = startedRunId ?? groupQuery.data?.activeSequenceRunId ?? null;

  const runQuery = useQuery({
    queryKey: queryKeys.sequenceRuns.detail(runId ?? ""),
    queryFn: () => getSequenceRun(runId ?? ""),
    enabled: runId !== null,
    refetchInterval: (q) =>
      q.state.data?.status === "running" ? RUNNING_POLL_MS : false,
    // 主查询：失败由进度卡渲染错误卡。
    meta: { silent: true },
  });

  const form = useForm<StartSequenceRunFormValues>({
    resolver: zodResolver(startSequenceRunSchema),
    defaultValues: { ...EMPTY_START_FORM, sequenceId: initialSequenceId },
  });
  const { control, getValues, handleSubmit } = form;
  const varRows = useFieldArray({ control, name: "vars" });
  const stepVarRows = useFieldArray({ control, name: "stepVars" });

  const selectedSequenceId = useWatch({ control, name: "sequenceId" });
  const sequences = sequencesQuery.data?.items;
  const selectedSequence = useMemo(
    () => sequences?.find((sequence) => sequence.id === selectedSequenceId),
    [sequences, selectedSequenceId],
  );

  const mutation = useMutation({
    mutationFn: (payload: StartSequenceRunPayload) =>
      startSequenceRun(groupId, payload),
  });
  const { mutateAsync } = mutation;

  const invalidateGroup = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.groups.detail(groupId),
    });
  }, [groupId, queryClient]);

  useRealtimeEvent<SequenceRunEventPayload>(
    "sequence_run",
    useCallback(
      (payload) => {
        if (payload.groupId !== groupId) return;

        void queryClient.invalidateQueries({
          queryKey: queryKeys.sequenceRuns.detail(payload.runId),
        });
        // activeSequenceRunId 跟着 run 的开始 / 结束变。
        invalidateGroup();
      },
      [groupId, invalidateGroup, queryClient],
    ),
  );

  /** 提交 = 本地预检并打开弹窗；解析不到的 key 在弹窗里标红，启动按钮禁用，不发请求。 */
  const onValid = useCallback(
    (values: StartSequenceRunFormValues) => {
      const sequence = sequences?.find((item) => item.id === values.sequenceId);

      if (!sequence) return;

      const payload = toStartSequenceRunPayload(values);

      setPreflight({
        result: resolveSequenceVars(
          sequence.steps,
          payload.vars ?? {},
          payload.stepVars ?? {},
        ),
        payload,
      });
      setServerUnresolved(null);
      setPreflightOpen(true);
    },
    [sequences],
  );

  /** 弹窗里的「启动」：只在本地预检通过时才会被调到（按钮禁用），这里再守一次。 */
  const confirmStart = useCallback(async () => {
    if (!preflight || preflight.result.unresolved.length > 0) return;

    try {
      const { runId: started } = await mutateAsync(preflight.payload);

      setPreflightOpen(false);
      setStartedRunId(started);
      invalidateGroup();
      toast.success("序列已启动");
    } catch (error) {
      const unresolved = getUnresolvedPlaceholder(error);

      if (unresolved) {
        setServerUnresolved({
          ...unresolved,
          varRows: getValues("vars").flatMap((row, i) =>
            row.key === unresolved.key ? [i] : [],
          ),
          stepVarRows: getValues("stepVars").flatMap((row, i) =>
            row.key === unresolved.key &&
            Number(row.stepIndex) === unresolved.stepIndex
              ? [i]
              : [],
          ),
        });
        setPreflightOpen(false);
        toast.error(
          `第 ${unresolved.stepIndex} 步的占位符 {${unresolved.key}} 解析不到`,
        );

        return;
      }

      if (isSequenceAlreadyRunning(error)) {
        setPreflightOpen(false);
        // 本地不知道那个 run：重拉群详情拿 activeSequenceRunId，进度卡随之出现。
        invalidateGroup();
        toast.error(ALREADY_RUNNING_MESSAGE);

        return;
      }

      toast.error(getErrorMessage(error, "启动失败，请重试"));
    }
  }, [getValues, invalidateGroup, mutateAsync, preflight]);

  const fillPlaceholders = useCallback(() => {
    if (!selectedSequence) return;

    const existing = new Set(getValues("vars").map((row) => row.key));

    for (const key of collectPlaceholders(selectedSequence.steps)) {
      if (!existing.has(key)) varRows.append({ key, value: "" });
    }
  }, [getValues, selectedSequence, varRows]);

  const group = groupQuery.data;
  const disabledReason = group
    ? (WRITE_BLOCKED_REASON[group.status] ??
      (group.activeSequenceRunId ? ALREADY_RUNNING_MESSAGE : null))
    : null;

  return {
    group,
    groupLoading: groupQuery.isPending && !groupQuery.data,
    groupError: groupQuery.error,
    groupRetrying: groupQuery.isFetching,
    refetchGroup: groupQuery.refetch,
    sequences: sequences ?? [],
    sequencesLoading: enabled && sequencesQuery.isPending,
    selectedSequenceId,
    selectedSteps: selectedSequence?.steps ?? NO_STEPS,
    register: form.register,
    errors: form.formState.errors,
    vars: varRows,
    stepVars: stepVarRows,
    serverUnresolved,
    disabledReason,
    fillPlaceholders,
    submit: handleSubmit(onValid),
    preflightOpen,
    setPreflightOpen,
    preflightResult: preflight?.result ?? null,
    starting: mutation.isPending,
    confirmStart,
    runId,
    run: runQuery.data,
    runLoading: runId !== null && runQuery.isPending && !runQuery.data,
    runError: runQuery.error,
    runRetrying: runQuery.isFetching,
    refetchRun: runQuery.refetch,
  };
}

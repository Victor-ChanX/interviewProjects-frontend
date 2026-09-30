// @vitest-environment jsdom
// 序列运行 hook：本地预检不通过不调后端；通过后调 startSequenceRun 并展示该 run；后端 422 高亮 stepIndex / key；
// 409 提示「已有运行中的序列」。service 层与 sonner 都 mock；`sequence_run` 事件的 invalidate 由
// useRealtimeQuerySync 负责（它的同位测试）。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALREADY_RUNNING_MESSAGE,
  useSequenceRun,
} from "@/components/sequence-run/use-sequence-run";
import { queryKeys } from "@/lib/query-keys";
import { RequestError } from "@/lib/request";
import type { GroupRead } from "@/services/group-service";
import type {
  SequenceRead,
  SequenceRunRead,
} from "@/services/sequence-service";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const service = vi.hoisted(() => ({
  listSequences: vi.fn(),
  startSequenceRun: vi.fn(),
  getSequenceRun: vi.fn(),
}));
const getGroup = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast }));

vi.mock("@/services/sequence-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/sequence-service")>()),
  ...service,
}));

vi.mock("@/services/group-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/group-service")>()),
  getGroup,
}));

const GROUP: GroupRead = {
  id: "g1",
  gatewayGroupId: "gw-1",
  status: "active",
  creatorAccountId: "a-1",
  agentEnabled: false,
  autoKickEnabled: false,
  members: [],
  activeSequenceRunId: null,
  activeAgentRunId: null,
};

/** 题目 B1 的两步序列。 */
const SEQUENCE: SequenceRead = {
  id: "s1",
  name: "发布会",
  createdAt: "2026-09-30T00:00:00.000Z",
  steps: [
    {
      index: 1,
      accountRole: "admin",
      text: "{event} 将于 {time} 开始，请提前准备",
      delaySeconds: 10,
    },
    {
      index: 2,
      accountRole: "member",
      text: "提醒：{event} 的资料已上传到 {location}",
      delaySeconds: 5,
    },
  ],
};

const RUN: SequenceRunRead = {
  id: "run-1",
  sequenceId: "s1",
  groupId: "g1",
  status: "running",
  currentStepIndex: 1,
  createdAt: "2026-09-30T00:00:00.000Z",
  finishedAt: null,
  steps: [],
};

function setup(group: GroupRead = GROUP) {
  getGroup.mockResolvedValue(group);
  service.listSequences.mockResolvedValue({ items: [SEQUENCE], total: 1 });
  service.getSequenceRun.mockResolvedValue(RUN);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook(
    () => useSequenceRun({ groupId: "g1", enabled: true }),
    { wrapper },
  );

  return { ...rendered, queryClient, invalidate };
}

type Hook = ReturnType<typeof useSequenceRun>;

/** 选序列、填 vars / stepVars 行（register 的 onChange 喂值，没有真实 DOM）。 */
async function fill(
  result: { current: Hook },
  values: {
    vars?: { key: string; value: string }[];
    stepVars?: { stepIndex: string; key: string; value: string }[];
  },
) {
  await act(async () => {
    await result.current
      .register("sequenceId")
      .onChange({ target: { name: "sequenceId", value: "s1" } });
  });

  for (const [i, row] of (values.vars ?? []).entries()) {
    act(() => result.current.vars.append({ key: "", value: "" }));
    await act(async () => {
      await result.current
        .register(`vars.${i}.key`)
        .onChange({ target: { name: `vars.${i}.key`, value: row.key } });
      await result.current
        .register(`vars.${i}.value`)
        .onChange({ target: { name: `vars.${i}.value`, value: row.value } });
    });
  }

  for (const [i, row] of (values.stepVars ?? []).entries()) {
    act(() =>
      result.current.stepVars.append({ stepIndex: "1", key: "", value: "" }),
    );
    await act(async () => {
      await result.current.register(`stepVars.${i}.stepIndex`).onChange({
        target: { name: `stepVars.${i}.stepIndex`, value: row.stepIndex },
      });
      await result.current
        .register(`stepVars.${i}.key`)
        .onChange({ target: { name: `stepVars.${i}.key`, value: row.key } });
      await result.current.register(`stepVars.${i}.value`).onChange({
        target: { name: `stepVars.${i}.value`, value: row.value },
      });
    });
  }
}

async function submitPreflight(result: { current: Hook }) {
  await act(async () => {
    await result.current.submit();
  });
}

afterEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe("useSequenceRun", () => {
  it("does not call the backend when the local preflight finds an unresolved key", async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.sequences).toHaveLength(1));

    await fill(result, {
      vars: [
        { key: "event", value: "发布会" },
        { key: "time", value: "10:00" },
      ],
    });
    await submitPreflight(result);

    expect(result.current.preflightOpen).toBe(true);
    expect(result.current.preflightResult?.unresolved).toEqual([
      { stepIndex: 2, key: "location" },
    ]);
    expect(result.current.preflightResult?.steps[1]?.entries).toEqual([
      { key: "event", value: "发布会", source: "default" },
      { key: "location", value: null, source: null },
    ]);

    await act(async () => {
      await result.current.confirmStart();
    });

    expect(service.startSequenceRun).not.toHaveBeenCalled();
  });

  it("starts the run with the folded payload and shows that run's progress", async () => {
    service.startSequenceRun.mockResolvedValueOnce({ runId: "run-1" });

    const { result, invalidate } = setup();

    await waitFor(() => expect(result.current.sequences).toHaveLength(1));

    await fill(result, {
      vars: [
        { key: "event", value: "发布会" },
        { key: "time", value: "10:00" },
        { key: "location", value: "共享盘/第一季度" },
      ],
      stepVars: [{ stepIndex: "2", key: "location", value: "共享盘/第二季度" }],
    });
    await submitPreflight(result);

    expect(result.current.preflightResult?.unresolved).toEqual([]);
    expect(result.current.preflightResult?.steps[1]?.entries).toContainEqual({
      key: "location",
      value: "共享盘/第二季度",
      source: "step:2",
    });

    await act(async () => {
      await result.current.confirmStart();
    });

    expect(service.startSequenceRun).toHaveBeenCalledWith("g1", {
      sequenceId: "s1",
      vars: { event: "发布会", time: "10:00", location: "共享盘/第一季度" },
      stepVars: { "2": { location: "共享盘/第二季度" } },
    });
    expect(result.current.preflightOpen).toBe(false);
    expect(result.current.runId).toBe("run-1");
    expect(toast.success).toHaveBeenCalledWith("序列已启动");
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.groups.detail("g1"),
    });
    await waitFor(() => expect(result.current.run).toEqual(RUN));
    expect(service.getSequenceRun).toHaveBeenCalledWith("run-1");
  });

  it("highlights the 422 stepIndex / key rows from the envelope and closes the dialog", async () => {
    service.startSequenceRun.mockRejectedValueOnce(
      new RequestError(
        422,
        "第 2 步的占位符 {location} 没有取值",
        {
          code: "UNRESOLVED_PLACEHOLDER",
          message: "第 2 步的占位符 {location} 没有取值",
          requestId: "req-1",
          stepIndex: 2,
          key: "location",
        },
        "UNRESOLVED_PLACEHOLDER",
      ),
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.sequences).toHaveLength(1));

    // 本地能过（location 在 vars 里给了），后端却拒绝：高亮要按后端说的 stepIndex / key 来。
    await fill(result, {
      vars: [
        { key: "event", value: "发布会" },
        { key: "time", value: "10:00" },
        { key: "location", value: "x" },
      ],
      stepVars: [
        { stepIndex: "1", key: "location", value: "y" },
        { stepIndex: "2", key: "location", value: "z" },
      ],
    });
    await submitPreflight(result);
    await act(async () => {
      await result.current.confirmStart();
    });

    expect(result.current.serverUnresolved).toEqual({
      stepIndex: 2,
      key: "location",
      varRows: [2],
      stepVarRows: [1],
    });
    expect(result.current.preflightOpen).toBe(false);
    expect(result.current.runId).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "第 2 步的占位符 {location} 解析不到",
    );
  });

  it("toasts 已有运行中的序列 on 409 and re-reads the group", async () => {
    service.startSequenceRun.mockRejectedValueOnce(
      new RequestError(
        409,
        "同群已有运行中的序列",
        { code: "SEQUENCE_ALREADY_RUNNING" },
        "SEQUENCE_ALREADY_RUNNING",
      ),
    );

    const { result, invalidate } = setup();

    await waitFor(() => expect(result.current.sequences).toHaveLength(1));

    await fill(result, {
      vars: [
        { key: "event", value: "发布会" },
        { key: "time", value: "10:00" },
        { key: "location", value: "x" },
      ],
    });
    await submitPreflight(result);
    invalidate.mockClear();
    await act(async () => {
      await result.current.confirmStart();
    });

    expect(toast.error).toHaveBeenCalledWith(ALREADY_RUNNING_MESSAGE);
    expect(result.current.serverUnresolved).toBeNull();
    expect(result.current.preflightOpen).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.groups.detail("g1"),
    });
  });

  it("shows the group's active run without starting anything and disables the form", async () => {
    const { result } = setup({ ...GROUP, activeSequenceRunId: "run-1" });

    await waitFor(() => expect(result.current.run).toEqual(RUN));

    expect(result.current.runId).toBe("run-1");
    expect(result.current.disabledReason).toBe(ALREADY_RUNNING_MESSAGE);
    expect(service.startSequenceRun).not.toHaveBeenCalled();
  });

  it("fills missing placeholder keys from the selected sequence as empty vars rows", async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.sequences).toHaveLength(1));

    await fill(result, { vars: [{ key: "event", value: "发布会" }] });
    act(() => result.current.fillPlaceholders());

    expect(result.current.vars.fields.map((row) => row.key)).toEqual([
      "event",
      "time",
      "location",
    ]);
  });
});

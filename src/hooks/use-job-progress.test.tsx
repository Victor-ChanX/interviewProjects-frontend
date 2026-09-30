// @vitest-environment jsdom
// job 进度 hook：轮询到终态就停、终态回调只调一次（WS `job` 事件按 jobId 的 invalidate 由
// useRealtimeQuerySync 负责，见它的同位测试）。service 层 mock；轮询用假时钟推进（不等真实时间），
// 所以这里不用 waitFor（它的轮询计时器同样被假时钟接管），改用 act + advanceTimersByTimeAsync 冲刷。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOB_POLL_MS,
  jobRefetchInterval,
  useJobProgress,
} from "@/hooks/use-job-progress";
import type { JobRead } from "@/services/job-service";

const getJob = vi.hoisted(() => vi.fn());

vi.mock("@/services/job-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/job-service")>()),
  getJob,
}));

function job(overrides: Partial<JobRead>): JobRead {
  return {
    id: "j1",
    kind: "create_group",
    status: "running",
    groupId: "g1",
    step: "create",
    errors: [],
    createdAt: "2026-09-30T10:00:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}

/** 请求回来之后 TanStack 通知订阅者、React 重渲染排在其后的几个定时器里；远小于轮询间隔。 */
const SETTLE_MS = 50;

/** 推进假时钟，再多推一小段让其间的请求、通知与重渲染落地（都在 act 里）。 */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
}

function setup(jobId: string | null, onSettled = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(
    ({ id, settled }) => useJobProgress(id, { onSettled: settled }),
    { wrapper, initialProps: { id: jobId, settled: onSettled } },
  );

  return { ...view, onSettled };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("jobRefetchInterval", () => {
  it("polls until the job is known and while it runs, then stops", () => {
    expect(jobRefetchInterval(undefined)).toBe(JOB_POLL_MS);
    expect(jobRefetchInterval(job({ status: "running" }))).toBe(JOB_POLL_MS);
    expect(jobRefetchInterval(job({ status: "finished" }))).toBe(false);
    expect(jobRefetchInterval(job({ status: "failed" }))).toBe(false);
  });
});

describe("useJobProgress", () => {
  it("does nothing before a job id exists", async () => {
    const { result } = setup(null);

    await tick(JOB_POLL_MS * 3);

    expect(getJob).not.toHaveBeenCalled();
    expect(result.current.job).toBeUndefined();
    expect(result.current.running).toBe(false);
  });

  it("polls a running job every second and stops once it is finished", async () => {
    getJob
      .mockResolvedValueOnce(job({ step: "create" }))
      .mockResolvedValueOnce(job({ step: "join:a1" }))
      .mockResolvedValue(
        job({
          status: "finished",
          step: "promote",
          finishedAt: "2026-09-30T10:00:05.000Z",
        }),
      );

    const { result, onSettled } = setup("j1");

    await tick(0);
    expect(getJob).toHaveBeenLastCalledWith("j1");
    expect(result.current.job?.step).toBe("create");
    expect(result.current.running).toBe(true);

    await tick(JOB_POLL_MS);
    expect(result.current.job?.step).toBe("join:a1");
    expect(onSettled).not.toHaveBeenCalled();

    await tick(JOB_POLL_MS);
    expect(result.current.job?.status).toBe("finished");
    expect(result.current.running).toBe(false);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ id: "j1", status: "finished", groupId: "g1" }),
    );

    const calls = getJob.mock.calls.length;

    await tick(JOB_POLL_MS * 5);
    expect(getJob).toHaveBeenCalledTimes(calls);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("reports a failed job with its errors once and stops polling", async () => {
    const failed = job({
      status: "failed",
      step: "join:a2",
      errors: [
        {
          step: "join:a2",
          stepKind: "join",
          accountId: "a2",
          code: "JOIN_TIMEOUT",
          message: null,
        },
      ],
    });

    getJob.mockResolvedValue(failed);

    const { result, onSettled } = setup("j1");

    await tick(0);
    expect(result.current.job).toEqual(failed);
    expect(result.current.running).toBe(false);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(failed);

    await tick(JOB_POLL_MS * 3);
    expect(getJob).toHaveBeenCalledTimes(1);
  });

  it("does not report the same settled job again when the callback changes", async () => {
    getJob.mockResolvedValue(job({ status: "finished" }));

    const { onSettled, rerender } = setup("j1");

    await tick(0);
    expect(onSettled).toHaveBeenCalledTimes(1);

    const next = vi.fn();

    rerender({ id: "j1", settled: next });
    await tick(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the request error while the job is unknown", async () => {
    getJob.mockRejectedValue(new Error("网络错误"));

    const { result } = setup("j1");

    await tick(0);
    expect(result.current.job).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.running).toBe(true);
  });
});

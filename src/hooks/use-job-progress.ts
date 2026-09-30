// 异步任务（建群 / 全部退群，202 { jobId }）的进度：GET /api/jobs/:jobId 进缓存，running 期间每
// JOB_POLL_MS 轮询一次（api.params-in-key：轮询用 refetchInterval，不用 useEffect），同时订阅 WS `job`
// 事件按 jobId invalidate —— 事件只带 { status, step }、不带 errors[]，所以重拉而不打补丁；连接断着时
// 轮询兜底。群列表的新建群与群详情的全部退群两个 feature 共用，所以在 src/hooks。
//
// 终态（finished / failed）时调一次 onSettled（同一个 jobId 只调一次），调用方在里面 toast / 跳转 /
// 刷新群详情。这是对「数据到了终态」的副作用，不是发请求，所以放 effect；请求本身只由 useQuery 发。

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { useRealtimeEvent } from "@/hooks/use-realtime";
import { queryKeys } from "@/lib/query-keys";
import {
  getJob,
  type JobEventPayload,
  type JobRead,
} from "@/services/job-service";

/** running 的 job 每隔这么久重拉一次（WS 事件是主通道，这是断线时的兜底）。 */
export const JOB_POLL_MS = 1_000;

/** 还没拿到 job 或仍在 running → 继续轮询；终态停止。请求失败不停：下一次轮询可能就好了。 */
export function jobRefetchInterval(job: JobRead | undefined): number | false {
  return job && job.status !== "running" ? false : JOB_POLL_MS;
}

export interface UseJobProgressOptions {
  /** 到终态时调一次（同一个 jobId 只调一次）。调用方用 useCallback 稳住。 */
  onSettled?: (job: JobRead) => void;
}

/**
 * @param jobId 202 拿到的 jobId；null 表示还没提交（不发请求、不订阅）。
 */
export function useJobProgress(
  jobId: string | null,
  { onSettled }: UseJobProgressOptions = {},
) {
  const queryClient = useQueryClient();
  const settledJobId = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? ""),
    queryFn: () => getJob(jobId ?? ""),
    enabled: jobId !== null,
    refetchInterval: (q) => jobRefetchInterval(q.state.data),
    // 进度在弹窗里展示，失败也在弹窗里显示，不再弹 toast。
    meta: { silent: true },
  });

  useRealtimeEvent<JobEventPayload>(
    "job",
    useCallback(
      (payload) => {
        if (jobId === null || payload.jobId !== jobId) return;

        void queryClient.invalidateQueries({
          queryKey: queryKeys.jobs.detail(jobId),
        });
      },
      [jobId, queryClient],
    ),
  );

  const job = jobId === null ? undefined : query.data;

  useEffect(() => {
    if (!job || job.status === "running") return;

    if (settledJobId.current === job.id) return;

    settledJobId.current = job.id;
    onSettled?.(job);
  }, [job, onSettled]);

  return {
    job,
    /** 已提交、还没到终态（含第一次查询还没回来）。 */
    running: jobId !== null && (job === undefined || job.status === "running"),
    error: jobId === null ? null : query.error,
    retrying: query.isFetching,
    refetch: query.refetch,
  };
}

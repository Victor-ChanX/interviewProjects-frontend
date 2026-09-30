// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentRunDetail,
  AgentStepRead,
} from "@/services/agent-run-service";

import { useAgentRunDetail } from "./use-agent-run-detail";

const getAgentRun = vi.hoisted(() => vi.fn());
const listGroups = vi.hoisted(() =>
  vi.fn().mockResolvedValue([{ id: "g1", gatewayGroupId: "g_abc" }]),
);

vi.mock("@/services/group-service", () => ({ listGroups }));
vi.mock("@/services/agent-run-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/agent-run-service")>()),
  getAgentRun,
}));

const protocolStep: AgentStepRead = {
  index: 1,
  kind: "protocol_error",
  toolUseId: null,
  name: null,
  input: null,
  resultSummary: "PROTOCOL_ERROR BAD_JSON: 响应不是 JSON",
  isError: true,
  errorCode: "BAD_JSON",
  auditVerdict: null,
  auditAttempts: 0,
  rawResponse: "{not json",
  createdAt: "2026-09-30T10:00:00.000Z",
  completedAt: "2026-09-30T10:00:01.000Z",
};

function run(overrides: Partial<AgentRunDetail> = {}): AgentRunDetail {
  return {
    id: "r1",
    groupId: "g1",
    status: "finished",
    endReason: "final",
    summary: "done",
    stepCount: 1,
    maxSteps: 12,
    budgetMs: 60_000,
    accumulatedMs: 1_000,
    triggerMessages: [],
    createdAt: "2026-09-30T10:00:00.000Z",
    finishedAt: "2026-09-30T10:00:02.000Z",
    steps: [protocolStep],
    ...overrides,
  };
}

function setup(runId = "r1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => useAgentRunDetail(runId), { wrapper });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAgentRunDetail", () => {
  it("loads the run with its steps and exposes the query contract", async () => {
    const detail = run();

    getAgentRun.mockResolvedValueOnce(detail);

    const { result } = setup();

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAgentRun).toHaveBeenCalledWith("r1");
    expect(result.current.run).toEqual(detail);
    expect(result.current.run?.steps[0]?.rawResponse).toBe("{not json");
    expect(result.current.error).toBeNull();
    expect(result.current.blocked).toBe(false);
    // 所在群用网关群 ID 显示（群列表缓存里查）。
    await waitFor(() => expect(result.current.groupName).toBe("g_abc"));
  });

  it("flags a blocked run", async () => {
    getAgentRun.mockResolvedValueOnce(
      run({ status: "blocked", endReason: "audit_blocked", summary: null }),
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.blocked).toBe(true);
    expect(result.current.run?.endReason).toBe("audit_blocked");
  });

  it("exposes the error for the view's error card instead of swallowing it", async () => {
    getAgentRun.mockRejectedValueOnce(new Error("404"));

    const { result } = setup("missing");

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    expect(result.current.run).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

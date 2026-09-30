import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api,
}));

import { RequestError } from "@/lib/request";
import {
  createSequence,
  getSequenceRun,
  getUnresolvedPlaceholder,
  groupSequenceRunsUrl,
  isSequenceAlreadyRunning,
  listSequences,
  sequenceRunUrl,
  startSequenceRun,
} from "@/services/sequence-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("url builders", () => {
  it("encode ids into both paths", () => {
    expect(groupSequenceRunsUrl("g 1")).toBe("/api/groups/g%201/sequence-runs");
    expect(sequenceRunUrl("r/1")).toBe("/api/sequence-runs/r%2F1");
  });
});

describe("listSequences", () => {
  it("GETs /api/sequences and returns { items, total } as-is", async () => {
    const body = { items: [{ id: "s1" }], total: 1 };

    api.get.mockResolvedValue(body);

    await expect(listSequences()).resolves.toEqual(body);
    expect(api.get).toHaveBeenCalledWith("/api/sequences");
  });
});

describe("createSequence", () => {
  it("POSTs the definition to /api/sequences", async () => {
    const definition = {
      name: "欢迎",
      steps: [
        {
          index: 1,
          accountRole: "admin" as const,
          text: "hi",
          delaySeconds: 0,
        },
      ],
    };

    api.post.mockResolvedValue({ id: "s1" });

    await expect(createSequence(definition)).resolves.toEqual({ id: "s1" });
    expect(api.post).toHaveBeenCalledWith("/api/sequences", definition);
  });
});

describe("startSequenceRun", () => {
  it("POSTs { sequenceId, vars, stepVars } to the group's sequence-runs path", async () => {
    const payload = {
      sequenceId: "s1",
      vars: { event: "发布会" },
      stepVars: { "2": { location: "共享盘" } },
    };

    api.post.mockResolvedValue({ runId: "run-1" });

    await expect(startSequenceRun("g1", payload)).resolves.toEqual({
      runId: "run-1",
    });
    expect(api.post).toHaveBeenCalledWith(
      "/api/groups/g1/sequence-runs",
      payload,
    );
  });
});

describe("getSequenceRun", () => {
  it("GETs /api/sequence-runs/:id", async () => {
    api.get.mockResolvedValue({ id: "run-1", steps: [] });

    await expect(getSequenceRun("run-1")).resolves.toEqual({
      id: "run-1",
      steps: [],
    });
    expect(api.get).toHaveBeenCalledWith("/api/sequence-runs/run-1");
  });
});

describe("getUnresolvedPlaceholder", () => {
  const envelope = {
    code: "UNRESOLVED_PLACEHOLDER",
    message: "第 3 步的占位符 {location} 没有取值",
    requestId: "req-1",
    stepIndex: 3,
    key: "location",
  };

  it("reads stepIndex / key out of a 422 UNRESOLVED_PLACEHOLDER envelope", () => {
    const error = new RequestError(
      422,
      envelope.message,
      envelope,
      envelope.code,
    );

    expect(getUnresolvedPlaceholder(error)).toEqual({
      stepIndex: 3,
      key: "location",
    });
  });

  it("returns null for other codes, other statuses, and a malformed envelope", () => {
    expect(
      getUnresolvedPlaceholder(
        new RequestError(
          422,
          "序列不存在",
          { code: "X" },
          "SEQUENCE_NOT_FOUND",
        ),
      ),
    ).toBeNull();
    expect(
      getUnresolvedPlaceholder(
        new RequestError(400, envelope.message, envelope, envelope.code),
      ),
    ).toBeNull();
    expect(
      getUnresolvedPlaceholder(
        new RequestError(
          422,
          envelope.message,
          { ...envelope, stepIndex: "3" },
          envelope.code,
        ),
      ),
    ).toBeNull();
    expect(getUnresolvedPlaceholder(new Error("boom"))).toBeNull();
    expect(getUnresolvedPlaceholder(null)).toBeNull();
  });
});

describe("isSequenceAlreadyRunning", () => {
  it("is true only for 409 SEQUENCE_ALREADY_RUNNING", () => {
    expect(
      isSequenceAlreadyRunning(
        new RequestError(
          409,
          "已有运行中的序列",
          {},
          "SEQUENCE_ALREADY_RUNNING",
        ),
      ),
    ).toBe(true);
    expect(
      isSequenceAlreadyRunning(
        new RequestError(409, "群不可写", {}, "GROUP_UNREACHABLE"),
      ),
    ).toBe(false);
    expect(isSequenceAlreadyRunning(new Error("boom"))).toBe(false);
  });
});

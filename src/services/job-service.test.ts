import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import { getJob, jobUrl } from "@/services/job-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("jobUrl", () => {
  it("encodes the id into the path", () => {
    expect(jobUrl("j/1 a")).toBe("/api/jobs/j%2F1%20a");
  });
});

describe("getJob", () => {
  it("GETs /api/jobs/:jobId and returns the job untouched", async () => {
    const job = {
      id: "j1",
      kind: "create_group",
      status: "running",
      groupId: "g1",
      step: "join:a1",
      errors: [],
      createdAt: "2026-09-30T00:00:00.000Z",
      finishedAt: null,
    };

    api.get.mockResolvedValue(job);

    await expect(getJob("j1")).resolves.toEqual(job);
    expect(api.get).toHaveBeenCalledWith("/api/jobs/j1");
  });
});

import { describe, expect, it } from "vitest";

import {
  createGroupSchema,
  toggleMember,
} from "@/components/group-list/create-group-schema";

function messages(input: unknown): string[] {
  const result = createGroupSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
}

describe("createGroupSchema", () => {
  it("accepts a creator and ordered members, keeping the order", () => {
    expect(
      createGroupSchema.parse({
        creatorAccountId: "a0",
        memberAccountIds: ["a2", "a1"],
      }),
    ).toEqual({ creatorAccountId: "a0", memberAccountIds: ["a2", "a1"] });
  });

  it("requires a creator and at least one member", () => {
    expect(messages({ creatorAccountId: "", memberAccountIds: [] })).toEqual([
      "请选择群主",
      "至少选择 1 个成员",
    ]);
  });

  it("rejects the creator among the members", () => {
    const result = createGroupSchema.safeParse({
      creatorAccountId: "a0",
      memberAccountIds: ["a1", "a0"],
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues).toEqual([
      expect.objectContaining({
        path: ["memberAccountIds"],
        message: "成员里不能包含群主",
      }),
    ]);
  });

  it("rejects duplicated members", () => {
    expect(
      messages({ creatorAccountId: "a0", memberAccountIds: ["a1", "a1"] }),
    ).toEqual(["成员不能重复"]);
  });
});

describe("toggleMember", () => {
  it("appends a newly checked member to the end", () => {
    expect(toggleMember(["a2"], "a1")).toEqual(["a2", "a1"]);
    expect(toggleMember([], "a1")).toEqual(["a1"]);
  });

  it("removes an unchecked member in place, keeping the rest in order", () => {
    expect(toggleMember(["a3", "a1", "a2"], "a1")).toEqual(["a3", "a2"]);
  });
});

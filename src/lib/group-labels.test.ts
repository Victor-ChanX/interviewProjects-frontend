import { describe, expect, it } from "vitest";

import {
  GROUP_STATUS_LABELS,
  GROUP_STATUS_TONE,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLE_TONE,
} from "@/lib/group-labels";

describe("group labels", () => {
  it("uses the manual-testing wording for group status", () => {
    expect(GROUP_STATUS_LABELS).toEqual({
      active: "正常",
      unreachable: "不可写",
      left: "已退出",
    });
    expect(GROUP_STATUS_TONE).toEqual({
      active: "success",
      unreachable: "danger",
      left: "muted",
    });
  });

  it("labels the three member roles", () => {
    expect(MEMBER_ROLE_LABELS).toEqual({
      creator: "群主",
      admin: "管理员",
      member: "成员",
    });
    expect(Object.keys(MEMBER_ROLE_TONE).sort()).toEqual([
      "admin",
      "creator",
      "member",
    ]);
  });
});

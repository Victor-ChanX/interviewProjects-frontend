import { describe, expect, it } from "vitest";

import {
  describeInconsistencyKind,
  INCONSISTENCY_TAB_LABELS,
} from "@/lib/inconsistency-labels";

describe("describeInconsistencyKind", () => {
  it("names the kinds the backend records", () => {
    expect(describeInconsistencyKind("inbound_unknown_group")).toBe("未知群");
    expect(describeInconsistencyKind("inbound_event_failed")).toBe(
      "入站事件处理失败",
    );
    expect(describeInconsistencyKind("leave_all_members_mismatch")).toBe(
      "退群对账不一致",
    );
    expect(describeInconsistencyKind("leave_all_reconcile_unavailable")).toBe(
      "退群对账未完成",
    );
  });

  it("returns unknown kinds untouched (and ignores prototype keys)", () => {
    expect(describeInconsistencyKind("something_new")).toBe("something_new");
    expect(describeInconsistencyKind("toString")).toBe("toString");
  });

  it("labels the two tabs", () => {
    expect(INCONSISTENCY_TAB_LABELS).toEqual({
      open: "未处理",
      resolved: "已处理",
    });
  });
});

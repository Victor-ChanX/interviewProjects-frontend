import { describe, expect, it } from "vitest";

import {
  ACCOUNT_STATUSES,
  ACCOUNT_TRANSITIONS,
  allowedTransitions,
  availableActions,
  canPerformAction,
  canTransition,
  isTerminalStatus,
  type AccountStatus,
} from "@/lib/account-transitions";

// 题目 A1 的转移表逐字抄成矩阵（行 = 从，列 = 到），测试与实现各持一份，改错任一边都会红。
const MATRIX: Record<AccountStatus, Record<AccountStatus, boolean>> = {
  idle: {
    idle: false,
    online: true,
    rate_limited: false,
    disconnected: false,
    suspended: true,
    session_expired: true,
  },
  online: {
    idle: true,
    online: false,
    rate_limited: true,
    disconnected: true,
    suspended: true,
    session_expired: true,
  },
  rate_limited: {
    idle: false,
    online: true,
    rate_limited: false,
    disconnected: true,
    suspended: true,
    session_expired: true,
  },
  disconnected: {
    idle: true,
    online: true,
    rate_limited: false,
    disconnected: false,
    suspended: true,
    session_expired: true,
  },
  suspended: {
    idle: false,
    online: false,
    rate_limited: false,
    disconnected: false,
    suspended: false,
    session_expired: false,
  },
  session_expired: {
    idle: false,
    online: false,
    rate_limited: false,
    disconnected: false,
    suspended: false,
    session_expired: false,
  },
};

describe("ACCOUNT_TRANSITIONS", () => {
  it("covers every status exactly once", () => {
    expect([...ACCOUNT_STATUSES].sort()).toEqual(Object.keys(MATRIX).sort());
  });

  it.each(
    ACCOUNT_STATUSES.flatMap((from) =>
      ACCOUNT_STATUSES.map((to) => [from, to, MATRIX[from][to]] as const),
    ),
  )("%s → %s is %s", (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });

  it("never allows a self transition", () => {
    for (const status of ACCOUNT_STATUSES) {
      expect(ACCOUNT_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it("lists the allowed targets in table order", () => {
    expect(allowedTransitions("rate_limited")).toEqual([
      "online",
      "disconnected",
      "suspended",
      "session_expired",
    ]);
    expect(allowedTransitions("suspended")).toEqual([]);
  });
});

describe("isTerminalStatus", () => {
  it("is true only for suspended and session_expired", () => {
    expect(ACCOUNT_STATUSES.filter(isTerminalStatus)).toEqual([
      "suspended",
      "session_expired",
    ]);
  });
});

describe("availableActions", () => {
  it("shows 标记离线 + 释放账号 for online", () => {
    expect(availableActions("online")).toEqual(["markOffline", "release"]);
  });

  it("shows only 标记离线 for rate_limited (reconnect is automatic)", () => {
    expect(availableActions("rate_limited")).toEqual(["markOffline"]);
    expect(canPerformAction("rate_limited", "reconnect")).toBe(false);
  });

  it("shows only 重连 for idle", () => {
    expect(availableActions("idle")).toEqual(["reconnect"]);
  });

  it("shows 重连 + 释放账号 for disconnected", () => {
    expect(availableActions("disconnected")).toEqual(["reconnect", "release"]);
  });

  it("shows nothing for terminal states", () => {
    expect(availableActions("suspended")).toEqual([]);
    expect(availableActions("session_expired")).toEqual([]);
  });
});

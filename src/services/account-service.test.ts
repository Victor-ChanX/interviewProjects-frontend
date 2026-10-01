import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestError } from "@/lib/request";
import {
  accountErrorCode,
  connectAccount,
  createAccount,
  listAccounts,
  transitionAccount,
  type AccountRead,
} from "@/services/account-service";

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { get: apiGet, post: apiPost },
}));

const ACCOUNT: AccountRead = {
  id: "acc-1",
  status: "online",
  platformUserId: "u-1",
  rateLimitedUntil: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("listAccounts", () => {
  it("returns the bare array from GET /api/accounts", async () => {
    apiGet.mockResolvedValueOnce([ACCOUNT]);

    await expect(listAccounts()).resolves.toEqual([ACCOUNT]);
    expect(apiGet).toHaveBeenCalledWith("/api/accounts");
  });
});

describe("connectAccount", () => {
  it("posts to /api/accounts/:id/connect with the id encoded", async () => {
    apiPost.mockResolvedValueOnce(ACCOUNT);

    await expect(connectAccount("acc/1")).resolves.toEqual(ACCOUNT);
    expect(apiPost).toHaveBeenCalledWith("/api/accounts/acc%2F1/connect");
  });
});

describe("transitionAccount", () => {
  it("posts { to, expectedFrom } to /api/accounts/:id/transition", async () => {
    const response = {
      ...ACCOUNT,
      status: "disconnected",
      from: "online",
      changed: true,
      membersRemovedCount: 0,
      messagesCancelledCount: 0,
      stepsSkippedCount: 0,
    };

    apiPost.mockResolvedValueOnce(response);

    await expect(
      transitionAccount("acc-1", {
        to: "disconnected",
        expectedFrom: "online",
      }),
    ).resolves.toEqual(response);
    expect(apiPost).toHaveBeenCalledWith("/api/accounts/acc-1/transition", {
      to: "disconnected",
      expectedFrom: "online",
    });
  });
});

describe("accountErrorCode", () => {
  it("returns the envelope code for known account errors", () => {
    expect(
      accountErrorCode(
        new RequestError(409, "状态已变化", undefined, "CAS_CONFLICT"),
      ),
    ).toBe("CAS_CONFLICT");
    expect(
      accountErrorCode(
        new RequestError(502, "网关不可用", undefined, "GATEWAY_ERROR"),
      ),
    ).toBe("GATEWAY_ERROR");
  });

  it("returns null for unknown codes, missing codes and non-request errors", () => {
    expect(
      accountErrorCode(new RequestError(403, "禁止", undefined, "FORBIDDEN")),
    ).toBeNull();
    expect(accountErrorCode(new RequestError(500, "boom"))).toBeNull();
    expect(accountErrorCode(new TypeError("fetch failed"))).toBeNull();
    expect(accountErrorCode("CAS_CONFLICT")).toBeNull();
  });
});

describe("createAccount", () => {
  it("POSTs { id } to /api/accounts and returns the new account", async () => {
    apiPost.mockResolvedValue({ ...ACCOUNT, id: "acc-9", status: "idle" });

    await expect(createAccount("acc-9")).resolves.toMatchObject({
      id: "acc-9",
      status: "idle",
    });
    expect(apiPost).toHaveBeenCalledWith("/api/accounts", { id: "acc-9" });
  });

  it("exposes ACCOUNT_EXISTS as a known error code", () => {
    expect(
      accountErrorCode(
        new RequestError(409, "账号已存在", undefined, "ACCOUNT_EXISTS"),
      ),
    ).toBe("ACCOUNT_EXISTS");
  });
});

// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSession } from "@/hooks/use-session";
import { clearSession, setAccessToken } from "@/lib/auth";

function base64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(username: string, role: "admin" | "viewer"): string {
  const payload = {
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  return `${base64Url("{}")}.${base64Url(JSON.stringify(payload))}.sig`;
}

afterEach(() => {
  clearSession();
  window.sessionStorage.clear();
});

describe("useSession", () => {
  it("is null before login and follows setAccessToken / clearSession", () => {
    const { result } = renderHook(() => useSession());

    expect(result.current).toBeNull();

    act(() => {
      setAccessToken(makeToken("admin", "admin"));
    });
    expect(result.current).toEqual({
      username: "admin",
      role: "admin",
      canWrite: true,
    });

    act(() => {
      clearSession();
    });
    expect(result.current).toBeNull();
  });

  it("marks viewer as read-only", () => {
    setAccessToken(makeToken("viewer", "viewer"));

    const { result } = renderHook(() => useSession());

    expect(result.current).toEqual({
      username: "viewer",
      role: "viewer",
      canWrite: false,
    });
  });
});

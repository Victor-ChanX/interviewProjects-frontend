import { describe, expect, it } from "vitest";

import { buildLoginRedirect, safeNextPath } from "@/lib/login-redirect";

describe("safeNextPath", () => {
  it("keeps in-site relative paths, including their query string", () => {
    expect(safeNextPath("/groups/g1")).toBe("/groups/g1");
    expect(safeNextPath("/groups/g1?tab=runs&x=1")).toBe(
      "/groups/g1?tab=runs&x=1",
    );
  });

  it("falls back for empty, absolute, protocol-relative or backslash paths", () => {
    expect(safeNextPath(null)).toBe("/accounts");
    expect(safeNextPath(undefined)).toBe("/accounts");
    expect(safeNextPath("")).toBe("/accounts");
    expect(safeNextPath("https://evil.example/")).toBe("/accounts");
    expect(safeNextPath("//evil.example/")).toBe("/accounts");
    expect(safeNextPath("/\\evil.example")).toBe("/accounts");
    expect(safeNextPath("accounts")).toBe("/accounts");
  });

  it("never sends the user back to the login page itself", () => {
    expect(safeNextPath("/login")).toBe("/accounts");
    expect(safeNextPath("/login?next=%2Fx")).toBe("/accounts");
    expect(safeNextPath("/login-history")).toBe("/login-history");
  });
});

describe("buildLoginRedirect", () => {
  it("encodes the current page as next", () => {
    expect(buildLoginRedirect("/groups/g1?tab=runs")).toBe(
      "/login?next=%2Fgroups%2Fg1%3Ftab%3Druns",
    );
  });

  it("omits next for the home page, the default landing page and unsafe paths", () => {
    expect(buildLoginRedirect("/")).toBe("/login");
    expect(buildLoginRedirect("/accounts")).toBe("/login");
    expect(buildLoginRedirect("/login")).toBe("/login");
    expect(buildLoginRedirect("//evil.example")).toBe("/login");
  });
});

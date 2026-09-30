// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildUrl, request, RequestError } from "@/lib/request";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("buildUrl", () => {
  it("appends only present query params, encoded", () => {
    expect(
      buildUrl("/api/x", { a: "中 文", b: undefined, c: null, d: "", e: 0 }),
    ).toBe("/api/x?a=%E4%B8%AD+%E6%96%87&e=0");
  });
});

describe("request error envelope", () => {
  it("exposes the backend { error: { code, message } } envelope as RequestError.code", async () => {
    stubFetch(
      jsonResponse(409, {
        error: { code: "CAS_CONFLICT", message: "状态已变化", requestId: "r1" },
      }),
    );

    const error = await request("/api/accounts/a/transition", {
      method: "POST",
      retries: 0,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "CAS_CONFLICT",
      message: "状态已变化",
    });
  });

  it("keeps FastAPI-style { detail } working with a null code", async () => {
    stubFetch(jsonResponse(422, { detail: "字段错误" }));

    await expect(request("/api/x", { retries: 0 })).rejects.toMatchObject({
      status: 422,
      code: null,
      message: "字段错误",
    });
  });

  it("falls back to an HTTP message when the body is not JSON", async () => {
    stubFetch(new Response("oops", { status: 502 }));

    await expect(request("/api/x", { retries: 0 })).rejects.toMatchObject({
      status: 502,
      code: null,
      message: "请求失败（HTTP 502）",
    });
  });
});

// @vitest-environment jsdom
// 时间线附件（前端 #24）：只为 mediaStatus = ready 的消息取文件，转成 object URL；卸载时 revoke。service 与 URL API 都 mock。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMessageMedia } from "@/components/group-detail/use-message-media";
import type { MessageRead } from "@/services/message-service";

const fetchMessageMedia = vi.hoisted(() => vi.fn());

vi.mock("@/services/message-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/message-service")>()),
  fetchMessageMedia,
}));

const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
const revokeObjectURL = vi.fn();

function msg(overrides: Partial<MessageRead>): MessageRead {
  return {
    msgId: "m",
    clientMsgId: null,
    senderPlatformUserId: "ext",
    isOwn: false,
    text: "t",
    sentAt: "2026-09-30T08:00:00.000Z",
    deliveryStatus: null,
    failCode: null,
    mediaUrl: null,
    localFilePath: null,
    mediaStatus: null,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL, revokeObjectURL }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useMessageMedia", () => {
  it("fetches only ready media and exposes object URLs keyed by msgId", async () => {
    fetchMessageMedia.mockImplementation(
      async (_g: string, msgId: string) =>
        new Blob([msgId], {
          type: msgId === "m-pdf" ? "application/pdf" : "image/png",
        }),
    );
    const messages = [
      msg({ msgId: "m-img", mediaUrl: "/media/1", mediaStatus: "ready" }),
      msg({ msgId: "m-pdf", mediaUrl: "/media/2", mediaStatus: "ready" }),
      msg({ msgId: "m-dl", mediaUrl: "/media/3", mediaStatus: "downloading" }),
      msg({ msgId: "m-none" }),
    ];

    const { result, unmount } = renderHook(
      () => useMessageMedia("g1", messages),
      { wrapper },
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(fetchMessageMedia.mock.calls).toEqual([
      ["g1", "m-img"],
      ["g1", "m-pdf"],
    ]);
    expect(result.current.get("m-img")).toEqual({
      url: "blob:image/png",
      isImage: true,
    });
    expect(result.current.get("m-pdf")).toEqual({
      url: "blob:application/pdf",
      isImage: false,
    });

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:image/png");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:application/pdf");
  });

  it("leaves a failed fetch out of the map (the view keeps its placeholder)", async () => {
    fetchMessageMedia.mockRejectedValue(new Error("404"));

    const { result } = renderHook(
      () =>
        useMessageMedia("g1", [
          msg({ msgId: "m-img", mediaUrl: "/media/1", mediaStatus: "ready" }),
        ]),
      { wrapper },
    );

    await waitFor(() => expect(fetchMessageMedia).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});

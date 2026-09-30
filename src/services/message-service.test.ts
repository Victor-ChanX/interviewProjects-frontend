import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({ api }));

import {
  listMessages,
  messageKey,
  messagesUrl,
  fetchMessageMedia,
  messageMediaUrl,
  sendMessage,
  sendUrl,
  type MessageRead,
} from "@/services/message-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("url builders", () => {
  it("encode the group id into both paths", () => {
    expect(messagesUrl("g 1")).toBe("/api/groups/g%201/messages");
    expect(sendUrl("g/1")).toBe("/api/groups/g%2F1/send");
  });

  it("encodes both ids into the media path", () => {
    expect(messageMediaUrl("g 1", "m/1")).toBe(
      "/api/groups/g%201/messages/m%2F1/media",
    );
  });
});

describe("fetchMessageMedia", () => {
  it("GETs the media path as a blob", async () => {
    const blob = new Blob(["x"], { type: "image/png" });

    api.get.mockResolvedValue(blob);

    await expect(fetchMessageMedia("g1", "m1")).resolves.toBe(blob);
    expect(api.get).toHaveBeenCalledWith("/api/groups/g1/messages/m1/media", {
      responseType: "blob",
    });
  });
});

describe("listMessages", () => {
  it("passes before + limit as query and returns the page as-is", async () => {
    const page = { items: [], nextCursor: "abc" };

    api.get.mockResolvedValue(page);

    await expect(
      listMessages("g1", { before: "cur", limit: 50 }),
    ).resolves.toEqual(page);
    expect(api.get).toHaveBeenCalledWith("/api/groups/g1/messages", {
      query: { before: "cur", limit: 50 },
    });
  });

  it("omits before on the first page", async () => {
    api.get.mockResolvedValue({ items: [], nextCursor: null });

    await listMessages("g1", { limit: 20 });

    expect(api.get).toHaveBeenCalledWith("/api/groups/g1/messages", {
      query: { before: undefined, limit: 20 },
    });
  });
});

describe("sendMessage", () => {
  it("POSTs accountId + text and returns the 202 body", async () => {
    api.post.mockResolvedValue({ clientMsgId: "c1" });

    await expect(
      sendMessage("g1", { accountId: "a1", text: "hi" }),
    ).resolves.toEqual({ clientMsgId: "c1" });
    expect(api.post).toHaveBeenCalledWith("/api/groups/g1/send", {
      accountId: "a1",
      text: "hi",
    });
  });
});

describe("messageKey", () => {
  const base: MessageRead = {
    msgId: null,
    clientMsgId: null,
    senderPlatformUserId: "u1",
    isOwn: false,
    text: "x",
    sentAt: "2026-09-30T00:00:00.000Z",
    deliveryStatus: null,
    failCode: null,
    mediaUrl: null,
    localFilePath: null,
    mediaStatus: null,
  };

  it("prefers clientMsgId, then msgId, then sender + sentAt", () => {
    expect(messageKey({ ...base, clientMsgId: "c1", msgId: "m1" })).toBe("c1");
    expect(messageKey({ ...base, msgId: "m1" })).toBe("m1");
    expect(messageKey(base)).toBe("u1:2026-09-30T00:00:00.000Z");
  });
});

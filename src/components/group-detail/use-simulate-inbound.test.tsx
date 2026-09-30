// @vitest-environment jsdom
// 「模拟外部发言」：只在 admin 且后端开关打开时可用；提交成功 toast + 关弹窗，失败 toast 后端的整句提示、弹窗留着。
// service 与 sonner 都 mock，不发真实请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSimulateInbound } from "@/components/group-detail/use-simulate-inbound";

const service = vi.hoisted(() => ({
  getSimControls: vi.fn(),
  simulateInbound: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/services/sim-control-service", () => service);
vi.mock("sonner", () => ({ toast }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return createElement(QueryClientProvider, { client: queryClient }, children);
}

/** 像用户在输入框里打字一样改 RHF 的值（hook 只暴露 register）。 */
async function type(
  register: ReturnType<typeof useSimulateInbound>["register"],
  name: "senderPlatformUserId" | "text",
  value: string,
): Promise<void> {
  await act(async () => {
    await register(name).onChange({ target: { name, value }, type: "change" });
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSimulateInbound", () => {
  it("is unavailable for viewers and never asks the backend", () => {
    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: false }),
      { wrapper },
    );

    expect(result.current.available).toBe(false);
    expect(service.getSimControls).not.toHaveBeenCalled();
  });

  it("follows the backend switch for admins", async () => {
    service.getSimControls.mockResolvedValue({ enabled: false });

    const off = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(service.getSimControls).toHaveBeenCalled());
    expect(off.result.current.available).toBe(false);

    service.getSimControls.mockResolvedValue({ enabled: true });

    const on = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(on.result.current.available).toBe(true));
  });

  it("pushes the trimmed message, toasts and closes the dialog", async () => {
    service.getSimControls.mockResolvedValue({ enabled: true });
    service.simulateInbound.mockResolvedValue({ gatewayGroupId: "g_abc" });

    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    act(() => result.current.setOpen(true));
    await type(result.current.register, "text", "  请问几点开始？ ");
    await act(async () => {
      await result.current.submit();
    });

    expect(service.simulateInbound).toHaveBeenCalledWith("g1", {
      senderPlatformUserId: "ext-demo",
      text: "请问几点开始？",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "已以 ext-demo 的身份推送，稍后出现在时间线",
    );
    expect(result.current.open).toBe(false);
  });

  it("does not call the backend when the form is invalid", async () => {
    service.getSimControls.mockResolvedValue({ enabled: true });

    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(service.simulateInbound).not.toHaveBeenCalled();
    expect(result.current.errors.text?.message).toBe("消息内容不能为空");
  });

  it("rejects a non-image or oversized file on selection, without a request", () => {
    service.getSimControls.mockResolvedValue({ enabled: true });

    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    act(() =>
      result.current.onImageChange(
        new File(["%PDF"], "a.pdf", { type: "application/pdf" }),
      ),
    );
    expect(result.current.imageError).toBe(
      "只支持 PNG / JPEG / GIF / WebP 图片",
    );
    expect(result.current.imageName).toBeNull();

    act(() =>
      result.current.onImageChange(
        new File([new Uint8Array(1024 * 1024 + 1)], "big.png", {
          type: "image/png",
        }),
      ),
    );
    expect(result.current.imageError).toBe("图片不能超过 1 MB");
  });

  it("sends the selected image as base64 media and clears it after success", async () => {
    service.getSimControls.mockResolvedValue({ enabled: true });
    service.simulateInbound.mockResolvedValue({ gatewayGroupId: "g_abc" });

    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    act(() =>
      result.current.onImageChange(
        new File([bytes], "cat.png", { type: "image/png" }),
      ),
    );
    expect(result.current.imageName).toBe("cat.png");
    await type(result.current.register, "text", "看图");
    await act(async () => {
      await result.current.submit();
    });

    expect(service.simulateInbound).toHaveBeenCalledWith("g1", {
      senderPlatformUserId: "ext-demo",
      text: "看图",
      media: { contentType: "image/png", base64: "iVBORw==" },
    });
    expect(result.current.imageName).toBeNull();
  });

  it("shows the backend's message and keeps the dialog open on failure", async () => {
    service.getSimControls.mockResolvedValue({ enabled: true });
    service.simulateInbound.mockRejectedValue(
      new Error("ext-demo 是本平台托管的账号 acc-1，外部成员发言请换一个 ID"),
    );

    const { result } = renderHook(
      () => useSimulateInbound({ groupId: "g1", enabled: true }),
      { wrapper },
    );

    act(() => result.current.setOpen(true));
    await type(result.current.register, "text", "hi");
    await act(async () => {
      await result.current.submit();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "ext-demo 是本平台托管的账号 acc-1，外部成员发言请换一个 ID",
    );
    expect(result.current.open).toBe(true);
  });
});

// @vitest-environment jsdom
// 「新增账号」（前端 #26）：提交成功 toast + 关弹窗 + 刷新账号列表；失败 toast 后端的整句提示、弹窗留着；表单不合法不发请求。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCreateAccount } from "@/components/account-list/use-create-account";
import { queryKeys } from "@/lib/query-keys";

const service = vi.hoisted(() => ({ createAccount: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/services/account-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/account-service")>()),
  createAccount: service.createAccount,
}));
vi.mock("sonner", () => ({ toast }));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { invalidate, ...renderHook(() => useCreateAccount(), { wrapper }) };
}

async function typeId(
  register: ReturnType<typeof useCreateAccount>["register"],
  value: string,
): Promise<void> {
  await act(async () => {
    await register("id").onChange({
      target: { name: "id", value },
      type: "change",
    });
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCreateAccount", () => {
  it("creates the trimmed id, refreshes the account list, toasts and closes", async () => {
    service.createAccount.mockResolvedValue({
      id: "acc-6",
      status: "idle",
      platformUserId: null,
      rateLimitedUntil: null,
    });

    const { result, invalidate } = setup();

    act(() => result.current.setOpen(true));
    await typeId(result.current.register, " acc-6 ");
    await act(async () => {
      await result.current.submit();
    });

    expect(service.createAccount).toHaveBeenCalledWith("acc-6");
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.accounts.all,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "已新增账号 acc-6，可以点「重连」连上网关",
    );
    expect(result.current.open).toBe(false);
  });

  it("does not call the backend for an invalid id", async () => {
    const { result } = setup();

    await typeId(result.current.register, "Bad Id");
    await act(async () => {
      await result.current.submit();
    });

    expect(service.createAccount).not.toHaveBeenCalled();
    expect(result.current.errors.id?.message).toBe(
      "只能用小写字母、数字、- 和 _，以字母或数字开头，最长 32 个字符",
    );
  });

  it("shows the backend's message and keeps the dialog open when the id exists", async () => {
    service.createAccount.mockRejectedValue(
      new Error("账号 acc-1 已存在，换一个 ID"),
    );

    const { result } = setup();

    act(() => result.current.setOpen(true));
    await typeId(result.current.register, "acc-1");
    await act(async () => {
      await result.current.submit();
    });

    expect(toast.error).toHaveBeenCalledWith("账号 acc-1 已存在，换一个 ID");
    expect(result.current.open).toBe(true);
  });
});

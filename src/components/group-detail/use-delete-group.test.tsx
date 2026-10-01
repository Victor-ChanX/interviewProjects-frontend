// @vitest-environment jsdom
// 删除已退出的群（前端 #25）：成功 → 回群列表、只刷新群列表（不碰还挂着的详情查询，免得重拉出 404）、toast；
// 失败 toast 后端提示、弹窗留着。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDeleteGroup } from "@/components/group-detail/use-delete-group";
import { queryKeys } from "@/lib/query-keys";

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const service = vi.hoisted(() => ({ deleteGroup: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/services/group-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/group-service")>()),
  deleteGroup: service.deleteGroup,
}));
vi.mock("sonner", () => ({ toast }));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  queryClient.setQueryData(queryKeys.groups.detail("g1"), { id: "g1" });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return {
    queryClient,
    invalidate,
    ...renderHook(() => useDeleteGroup("g1"), { wrapper }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDeleteGroup", () => {
  it("deletes, leaves for the group list, refreshes only the list and toasts", async () => {
    service.deleteGroup.mockResolvedValue({
      id: "g1",
      messagesDeleted: 3,
      agentRunsDeleted: 1,
      sequenceRunsDeleted: 0,
    });

    const { result, queryClient, invalidate } = setup();

    act(() => result.current.setOpen(true));
    await act(async () => {
      await result.current.confirm();
    });

    expect(service.deleteGroup).toHaveBeenCalledWith("g1");
    expect(navigate).toHaveBeenCalledWith("/groups", { replace: true });
    expect(queryClient.getQueryData(queryKeys.groups.detail("g1"))).toEqual({
      id: "g1",
    });
    // 只刷新列表：还挂着的详情页若被清缓存 / 被 invalidate，会立刻重拉出 404
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.groups.list(),
    });
    expect(toast.success).toHaveBeenCalledWith("群已删除（3 条消息一并删除）");
    expect(result.current.open).toBe(false);
  });

  it("shows the backend's reason and stays put on failure", async () => {
    service.deleteGroup.mockRejectedValue(
      new Error("只能删除已退出的群：先「全部退群」，完成后再删除"),
    );

    const { result } = setup();

    act(() => result.current.setOpen(true));
    await act(async () => {
      await result.current.confirm();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "只能删除已退出的群：先「全部退群」，完成后再删除",
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });
});

import {
  type InfiniteData,
  InfiniteQueryObserver,
  QueryClient,
} from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { updateQueryData } from "@/lib/query-updates";

type Page = { items: string[]; next: string | null };
type Feed = InfiniteData<Page, string | null>;

const KEY = ["feed"] as const;

/** 幂等的「插到最新页头部」：已有就原样返回。 */
function prepend(item: string) {
  return (data: Feed): Feed =>
    data.pages.some((page) => page.items.includes(item))
      ? data
      : {
          ...data,
          pages: data.pages.map((page, i) =>
            i === 0 ? { ...page, items: [item, ...page.items] } : page,
          ),
        };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};

  let reject: (error: unknown) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function items(queryClient: QueryClient) {
  return queryClient.getQueryData<Feed>(KEY)?.pages.map((page) => page.items);
}

function setup(fetchPage: (cursor: string | null) => Promise<Page>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const observer = new InfiniteQueryObserver<
    Page,
    Error,
    Feed,
    typeof KEY,
    string | null
  >(queryClient, {
    queryKey: KEY,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null,
    getNextPageParam: (last) => last.next,
  });

  return { queryClient, observer };
}

describe("updateQueryData", () => {
  it("applies the update right away and does not create a missing cache", () => {
    const queryClient = new QueryClient();

    updateQueryData<Feed>(queryClient, KEY, prepend("x"));
    expect(queryClient.getQueryData(KEY)).toBeUndefined();

    queryClient.setQueryData<Feed>(KEY, {
      pages: [{ items: ["m1"], next: null }],
      pageParams: [null],
    });
    updateQueryData<Feed>(queryClient, KEY, prepend("x"));

    expect(items(queryClient)).toEqual([["x", "m1"]]);
  });

  // 前端 #16：fetchNextPage 写回的是开始时的已加载页 + 更早一页
  it("survives the write-back of a fetchNextPage that was in flight", async () => {
    const older = deferred<Page>();
    const { queryClient, observer } = setup((cursor) =>
      cursor === null
        ? Promise.resolve({ items: ["m2", "m1"], next: "c1" })
        : older.promise,
    );

    await observer.refetch();

    const loading = observer.fetchNextPage();

    updateQueryData<Feed>(queryClient, KEY, prepend("NEW"));
    expect(items(queryClient)).toEqual([["NEW", "m2", "m1"]]);

    older.resolve({ items: ["old1"], next: null });
    await loading;

    expect(items(queryClient)).toEqual([["NEW", "m2", "m1"], ["old1"]]);
    expect(queryClient.getQueryData<Feed>(KEY)?.pageParams).toEqual([
      null,
      "c1",
    ]);
  });

  it("replays every update made during the fetch in order, once the fetch ends", async () => {
    const older = deferred<Page>();
    const { queryClient, observer } = setup((cursor) =>
      cursor === null
        ? Promise.resolve({ items: ["m1"], next: "c1" })
        : older.promise,
    );

    await observer.refetch();

    const loading = observer.fetchNextPage();

    updateQueryData<Feed>(queryClient, KEY, prepend("a"));
    updateQueryData<Feed>(queryClient, KEY, prepend("b"));

    older.resolve({ items: ["old1"], next: null });
    await loading;

    expect(items(queryClient)).toEqual([["b", "a", "m1"], ["old1"]]);

    // 请求已结束：之后的更新不再被记下重放（下一次请求不会把它们再跑一遍）。
    const again = observer.refetch();

    updateQueryData<Feed>(queryClient, KEY, prepend("c"));
    await again;

    expect(items(queryClient)?.[0]).toContain("c");
  });

  it("survives a whole-list refetch (invalidate) that started before the update", async () => {
    let head = deferred<Page>();
    const { queryClient, observer } = setup(() => head.promise);
    const unsubscribe = observer.subscribe(() => {});

    head.resolve({ items: ["m1"], next: null });
    await observer.refetch();

    head = deferred<Page>();

    const refetching = queryClient.invalidateQueries({ queryKey: KEY });

    updateQueryData<Feed>(queryClient, KEY, prepend("NEW"));

    // 重拉的首页早于 NEW 落库
    head.resolve({ items: ["m1"], next: null });
    await refetching;

    expect(items(queryClient)).toEqual([["NEW", "m1"]]);
    unsubscribe();
  });

  it("keeps the update exactly once when the fetch fails", async () => {
    const older = deferred<Page>();
    const { queryClient, observer } = setup((cursor) =>
      cursor === null
        ? Promise.resolve({ items: ["m1"], next: "c1" })
        : older.promise,
    );

    await observer.refetch();

    const loading = observer.fetchNextPage();

    updateQueryData<Feed>(queryClient, KEY, prepend("NEW"));
    older.reject(new Error("boom"));
    await loading;

    expect(items(queryClient)).toEqual([["NEW", "m1"]]);
  });
});

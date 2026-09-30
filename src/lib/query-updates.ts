// 实时事件写缓存时「请求进行中」的那一段（前端 #16）。
//
// TanStack v5 的一次 fetch 在开始时拿走当时的缓存（infiniteQueryBehavior 读 context.state.data.pages），
// 结束时整份写回：「加载更早」写回「开始时的已加载页 + 更早一页」，整体重拉写回「按开始时的页数重拉的结果」。
// 这期间 setQueryData 并进来的东西（新消息、自己消息的投递状态、动态流插头）会被这次写回覆盖掉，
// 新消息要等下一条事件才出现，投递状态可能永远停在旧值。
//
// 做法：写缓存照常立刻生效（页面不等），同时若这条 query 正在请求，把 updater 记在这次请求上；
// 请求结束（成功写回、失败、取消回滚，fetchStatus 回到 idle）时按原顺序在结果上重放一遍。
// 所以 updater 必须幂等、只依赖传入的 data（「按 key 替换 / 插入」「按 id 改字段」这类）——
// 请求失败时缓存里本来就已经有它们的效果，重放一遍不变。重放的行数据是它当时拉到的那份：整体重拉的首页
// 比它先发出，同一行被重放「退回」到更旧版本只在极窄的竞态里出现，下一条事件的补拉会再覆盖。
// 不改用「手动拉更早一页再 setQueryData 拼上去」：那样同样挡不住整体重拉（invalidate / 回到页面时的
// stale 重拉）那条写回路径，还得自己维护 isFetchingNextPage / hasNextPage。

import type { QueryClient, QueryKey } from "@tanstack/react-query";

type Updater = (data: unknown) => unknown;

/** 按 Query 实例记：同 key 的缓存被移除后重建就是另一份，旧的记录随之作废。 */
const replays = new WeakMap<object, Updater[]>();

/**
 * 函数式更新缓存（缓存里没有就不造），并保证它挺过进行中的请求的写回。
 * updater 要幂等：请求结束后会在请求结果上再跑一遍。
 */
export function updateQueryData<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (data: T) => T,
): void {
  queryClient.setQueryData<T>(queryKey, (old) =>
    old === undefined ? old : updater(old),
  );

  const cache = queryClient.getQueryCache();
  const query = cache.find({ queryKey, exact: true });

  if (!query || query.state.fetchStatus === "idle") return;

  const queued = replays.get(query);

  if (queued) {
    queued.push(updater as Updater);

    return;
  }

  const ops: Updater[] = [updater as Updater];

  replays.set(query, ops);

  const unsubscribe = cache.subscribe((event) => {
    if (event.query !== query) return;

    if (event.type === "removed") {
      unsubscribe();
      replays.delete(query);

      return;
    }

    if (query.state.fetchStatus !== "idle") return;

    // 这一刻缓存已是请求的写回结果（或失败 / 回滚后的状态）：把期间的更新按顺序重放上去。
    unsubscribe();
    replays.delete(query);
    queryClient.setQueryData<T>(queryKey, (old) =>
      old === undefined
        ? old
        : (ops.reduce<unknown>((data, op) => op(data), old) as T),
    );
  });
}

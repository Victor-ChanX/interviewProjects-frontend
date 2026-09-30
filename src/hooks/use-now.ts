// 「现在」的时刻，按固定间隔刷新：相对时间（「3分钟前」）要跟着走，但渲染期不反复 new Date()。
// 只在 effect 与惰性初值里取时间（frontend-api-function-calls「时间区间参数」）。

import { useEffect, useState } from "react";

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

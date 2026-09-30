// queryKey 集中登记：每域一个对象，`all` 前缀 + 带参函数，省参即前缀
// （frontend-api-function-calls「useQuery」MUST api.query-keys）。新查询先在这里加 key。
// 登录（POST /api/auth/login）是 mutation、会话在 src/lib/auth.ts，没有 auth 域的 query key；
// 后端也没有 /me 端点（身份从 token 解）。

export const queryKeys = {
  // 账号（题目 2.3 accounts；前端 #3）：GET /api/accounts 是裸数组、无参数，list() 不带 params。
  accounts: {
    all: ["accounts"] as const,
    list: () => ["accounts", "list"] as const,
  },
  // 群（题目 2.3 groups；前端 #4）：GET /api/groups 裸数组无参数；详情按 id。
  groups: {
    all: ["groups"] as const,
    list: () => ["groups", "list"] as const,
    detail: (id: string) => ["groups", "detail", id] as const,
  },
  // 群消息时间线（useInfiniteQuery，游标在 pageParam 里、不进 key）。
  messages: {
    all: ["messages"] as const,
    timeline: (groupId: string) => ["messages", "timeline", groupId] as const,
  },
  // Agent run：按群的列表 + 单条详情。
  agentRuns: {
    all: ["agent-runs"] as const,
    byGroup: (groupId: string) => ["agent-runs", "group", groupId] as const,
    detail: (id: string) => ["agent-runs", "detail", id] as const,
  },
  // 序列定义（题目 B1；前端 #6）：GET /api/sequences 是 { items, total }、无参数。
  sequences: {
    all: ["sequences"] as const,
    list: () => ["sequences", "list"] as const,
  },
  // 序列运行：单条详情按 id（WS `sequence_run` 事件按 runId invalidate）。
  sequenceRuns: {
    all: ["sequence-runs"] as const,
    detail: (id: string) => ["sequence-runs", "detail", id] as const,
  },
} as const;

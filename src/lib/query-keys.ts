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
    // 附件文件（前端 #24，GET /api/groups/:id/messages/:msgId/media 的 blob）：文件一旦下好不再变
    media: (groupId: string, msgId: string) =>
      ["messages", "media", groupId, msgId] as const,
  },
  // Agent run：按群的列表 + 单条详情。
  agentRuns: {
    all: ["agent-runs"] as const,
    byGroup: (groupId: string) => ["agent-runs", "group", groupId] as const,
    // 全局列表（后端 #22，游标在 pageParam 里、不进 key）：筛选参数进 key，空串表示不筛；
    // lists() 是所有筛选组合的前缀（WS 事件按它 invalidate）。
    lists: () => ["agent-runs", "list"] as const,
    list: (filters: { status: string; groupId: string }) =>
      ["agent-runs", "list", filters.status, filters.groupId] as const,
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
  // 异步任务（建群 / 全部退群；前端 #10）：GET /api/jobs/:jobId，running 期间轮询 + WS `job` 事件按 id invalidate。
  jobs: {
    all: ["jobs"] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
  },
  // LLM 设置（后端 #19；前端 #9）：GET /api/llm/settings 无参数，响应不含 key 明文。
  // 获取模型列表 / 保存带 key，不走 query / mutation 缓存，所以这里没有它们的 key。
  llmSettings: {
    all: ["llm-settings"] as const,
    detail: () => ["llm-settings", "detail"] as const,
  },
  // 演示用模拟控制（后端 #46）：开关状态，无参数。
  simControls: {
    all: ["sim-controls"] as const,
    status: () => ["sim-controls", "status"] as const,
  },
  // 工作台概览（后端 #22）：工作台与侧栏「异常中心」的未处理数共用。「今日」按查看者时区（后端 #47），
  // 时区进 key；省参即全部时区的前缀（WS 同步按前缀改）。
  dashboard: {
    all: ["dashboard"] as const,
    summary: (timeZone?: string) =>
      timeZone === undefined
        ? (["dashboard", "summary"] as const)
        : (["dashboard", "summary", timeZone] as const),
  },
  // 最近动态（GET /api/activity，useInfiniteQuery；游标在 pageParam 里）：每页条数不同的两处（工作台 20、
  // 实时动态页 50）各一份缓存。
  activity: {
    all: ["activity"] as const,
    feed: (limit: number) => ["activity", "feed", limit] as const,
  },
  // 异常中心：列表按页签（open / resolved）各一份，详情按 id。
  inconsistencies: {
    all: ["inconsistencies"] as const,
    // 两个页签的列表共同前缀（新记录 / 被标记时按它重拉；详情另由事件就地改）。
    lists: () => ["inconsistencies", "list"] as const,
    list: (tab: string) => ["inconsistencies", "list", tab] as const,
    detail: (id: string) => ["inconsistencies", "detail", id] as const,
  },
} as const;

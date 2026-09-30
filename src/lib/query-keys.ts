// queryKey 集中登记：每域一个对象，`all` 前缀 + 带参函数，省参即前缀
// （frontend-api-function-calls「useQuery」MUST api.query-keys）。新查询先在这里加 key。

export interface ExampleListParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export const queryKeys = {
  examples: {
    all: ["examples"] as const,
    list: (params: ExampleListParams = {}) =>
      ["examples", "list", params] as const,
    detail: (id: number) => ["examples", "detail", id] as const,
  },
} as const;

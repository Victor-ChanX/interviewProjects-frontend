// endpoint wrapper：URL、方法、query string、normalize 都在这里（api.wrapper-owns-url）；
// 类型从 api.generated 派生（api.types-derived），不手写 interface。

import { api } from "@/lib/api";
import type { ExampleListParams } from "@/lib/query-keys";
import type { components } from "@/types/api.generated";

export type ExampleRead = components["schemas"]["ExampleRead"];

export type ExampleListResponse = components["schemas"]["ExampleListResponse"];

/** 前端消费的列表负载：分页形状 `{ items, total, page, pageSize }` 直接透传（字段由快照派生）。 */
export type ExampleListPayload = ExampleListResponse;

const EXAMPLES_URL = "/api/examples";

export function normalizeExampleListPayload(
  raw: ExampleListResponse,
): ExampleListPayload {
  return raw;
}

export async function listExamples(
  params: ExampleListParams = {},
): Promise<ExampleListPayload> {
  const raw = await api.get<ExampleListResponse>(EXAMPLES_URL, {
    query: { page: params.page, pageSize: params.pageSize },
  });

  return normalizeExampleListPayload(raw);
}

export function getExample(id: number): Promise<ExampleRead> {
  return api.get<ExampleRead>(`${EXAMPLES_URL}/${encodeURIComponent(id)}`);
}

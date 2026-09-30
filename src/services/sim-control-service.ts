// 演示用模拟控制端点 wrapper（后端 #46：`GET /api/sim-controls`、`POST /api/groups/:id/simulate-inbound`；前端 #19）。
// 后端开关 SIM_CONTROLS_ENABLED 打开时，admin 可以代推一条「外部成员发言」到网关模拟器；消息随后照常经实时推送
// 进入时间线（202 只表示模拟器收下了），开着 Agent 自动回复的群会随之触发一次运行。

import { api } from "@/lib/api";
import { groupUrl } from "@/services/group-service";
import type { components, paths } from "@/types/api.generated";

export type SimControlsRead = components["schemas"]["SimControlsRead"];

export type SimulateInboundResponse =
  components["schemas"]["SimulateInboundResponse"];

export type SimulateInboundPayload =
  paths["/api/groups/{id}/simulate-inbound"]["post"]["requestBody"]["content"]["application/json"];

const SIM_CONTROLS_URL = "/api/sim-controls";

// /api/groups 这个前缀的 owner 是 group-service（duplicate-endpoint-literal），这里只拼子路径。
export function simulateInboundUrl(groupId: string): string {
  return `${groupUrl(groupId)}/simulate-inbound`;
}

export function getSimControls(): Promise<SimControlsRead> {
  return api.get<SimControlsRead>(SIM_CONTROLS_URL);
}

export function simulateInbound(
  groupId: string,
  payload: SimulateInboundPayload,
): Promise<SimulateInboundResponse> {
  return api.post<SimulateInboundResponse>(
    simulateInboundUrl(groupId),
    payload,
  );
}

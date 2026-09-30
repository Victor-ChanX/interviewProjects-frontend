// 长 id（UUIDv7）在表格与动态里的缩写。UUIDv7 的前 48 位是时间戳，同一时段建的群前缀几乎一样，
// 所以取末尾而不是开头；短 id（acc-1、g_xxx）原样返回。完整 id 放在 title 里给人复制。

const SHORT_ID_TAIL = 8;

/** 不超过这个长度的 id（acc-1、g_5ffed3d96722）原样显示。 */
const SHORT_ID_MAX = 16;

export function shortId(id: string): string {
  if (id.length <= SHORT_ID_MAX) return id;

  return `…${id.slice(-SHORT_ID_TAIL)}`;
}

/** 群在界面上的名字：有网关群 ID 用它（人工测试手册、模拟器命令都用它），没有退回缩写的本地 id。 */
export function groupDisplayName(group: {
  id: string;
  gatewayGroupId: string | null;
}): string {
  return group.gatewayGroupId ?? shortId(group.id);
}

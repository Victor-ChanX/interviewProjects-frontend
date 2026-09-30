import { useParams } from "react-router";

import { GroupDetailContainer } from "@/components/group-detail/group-detail-container";

export function Component() {
  // 路由登记为 /groups/:groupId，参数一定存在；默认值只为收窄类型。
  const { groupId = "" } = useParams();

  return <GroupDetailContainer groupId={groupId} />;
}

import { useParams } from "react-router";

import { SequenceRunContainer } from "@/components/sequence-run/sequence-run-container";

export function Component() {
  // 路由登记为 /groups/:groupId/sequences，参数一定存在；默认值只为收窄类型。
  const { groupId = "" } = useParams();

  return <SequenceRunContainer groupId={groupId} />;
}

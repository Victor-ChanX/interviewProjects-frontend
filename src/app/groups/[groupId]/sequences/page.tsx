import { useParams, useSearchParams } from "react-router";

import { SequenceRunContainer } from "@/components/sequence-run/sequence-run-container";

export function Component() {
  // 路由登记为 /groups/:groupId/sequences，参数一定存在；默认值只为收窄类型。
  const { groupId = "" } = useParams();
  // 从「定时序列」页「在群启动」进来时带 ?sequenceId=，表单初始选中它。
  const [searchParams] = useSearchParams();

  return (
    <SequenceRunContainer
      groupId={groupId}
      initialSequenceId={searchParams.get("sequenceId") ?? undefined}
    />
  );
}

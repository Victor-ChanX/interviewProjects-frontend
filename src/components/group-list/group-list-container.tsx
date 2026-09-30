// container：hook 编排 + 路由跳转；渲染就绪的数据与回调通过 props 交给 view。

import { useCallback } from "react";
import { useNavigate } from "react-router";

import { GroupListView } from "./group-list-view";
import { useGroupList } from "./use-group-list";

export function GroupListContainer() {
  const navigate = useNavigate();
  const list = useGroupList();
  const { refetch } = list;

  const onOpen = useCallback(
    (id: string) => {
      void navigate(`/groups/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <GroupListView
      groups={list.groups}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      onRetry={onRetry}
      onOpen={onOpen}
    />
  );
}

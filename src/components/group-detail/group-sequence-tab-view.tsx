// 群详情的「序列」页签：进行中的序列 + 去序列运行页（预检 / 启动 / 进度）与定时序列列表的入口。

import { CalendarClock, ListOrdered } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { shortId } from "@/lib/short-id";

export function GroupSequenceTabView({
  activeSequenceRunId,
  sequenceHref,
  canWrite,
}: {
  activeSequenceRunId: string | null;
  sequenceHref: string;
  canWrite: boolean;
}) {
  return (
    <Empty className="border border-dashed border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarClock />
        </EmptyMedia>
        <EmptyTitle>
          {activeSequenceRunId
            ? `有一个序列正在运行（${shortId(activeSequenceRunId)}）`
            : "这个群没有进行中的序列"}
        </EmptyTitle>
        <EmptyDescription>
          序列按步骤与延迟由管理员 /
          成员账号依次发言；启动前先预检每个占位符的取值。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        <Button render={<Link to={sequenceHref} />} nativeButton={false}>
          <CalendarClock />
          {activeSequenceRunId
            ? "查看进度"
            : canWrite
              ? "序列运行"
              : "查看序列运行"}
        </Button>
        <Button
          variant="outline"
          render={<Link to="/sequences" />}
          nativeButton={false}
        >
          <ListOrdered />
          定时序列列表
        </Button>
      </EmptyContent>
    </Empty>
  );
}

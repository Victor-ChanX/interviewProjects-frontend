// 时间线里的附件（题目 C1，前端 #24）：mediaStatus = ready 的消息，经请求层取回文件 Blob（`<img>` 带不上 Bearer），
// 转成 object URL 交给 view。文件下好就不再变：staleTime 无限；URL 在这一组 Blob 换掉或卸载时 revoke。
// 附件状态变了（下载好 / 过期 / 清理）后端会推 message 事件，时间线重拉后 mediaStatus 跟着变，这里的查询集随之增减。

import { type QueryObserverResult, useQueries } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { isImageBlob } from "@/lib/message-labels";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchMessageMedia,
  type MessageRead,
} from "@/services/message-service";

import type { TimelineMedia } from "./types";

/** 放在模块顶层：combine 引用稳定，查询结果没变时返回同一个数组（不白建 object URL） */
function blobsOf(results: QueryObserverResult<Blob>[]): (Blob | undefined)[] {
  return results.map((r) => r.data);
}

export function useMessageMedia(
  groupId: string,
  messages: MessageRead[],
): ReadonlyMap<string, TimelineMedia> {
  const readyKey = messages
    .filter((m) => m.mediaStatus === "ready" && m.msgId !== null)
    .map((m) => m.msgId)
    .join("\n");
  const ready = useMemo(
    () => (readyKey === "" ? [] : readyKey.split("\n")),
    [readyKey],
  );

  const blobs = useQueries({
    queries: ready.map((msgId) => ({
      queryKey: queryKeys.messages.media(groupId, msgId),
      queryFn: () => fetchMessageMedia(groupId, msgId),
      staleTime: Infinity,
      // 取不到就显示占位，不弹 toast（一页里可能有很多条）
      meta: { silent: true },
    })),
    combine: blobsOf,
  });

  const media = useMemo(() => {
    const map = new Map<string, TimelineMedia>();

    ready.forEach((msgId, i) => {
      const blob = blobs[i];

      if (blob)
        map.set(msgId, {
          url: URL.createObjectURL(blob),
          isImage: isImageBlob(blob),
        });
    });

    return map;
  }, [ready, blobs]);

  useEffect(
    () => () => {
      for (const m of media.values()) URL.revokeObjectURL(m.url);
    },
    [media],
  );

  return media;
}

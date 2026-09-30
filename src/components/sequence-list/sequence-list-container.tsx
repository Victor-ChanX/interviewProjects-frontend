// container：定时序列页的编排 —— 列表、新建序列对话框（admin）、「在群启动」对话框（选群 → 跳到该群的序列运行页，
// 带 ?sequenceId= 让那边的表单初始选中它）。对话框的开关与选中的序列是两个 state：关只切 open，内容留到下次打开。

import { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { useSession } from "@/hooks/use-session";
import type { SequenceRead } from "@/services/sequence-service";

import { SequenceListView } from "./sequence-list-view";
import { useCreateSequence } from "./use-create-sequence";
import { useSequenceList } from "./use-sequence-list";

const CREATE_FORM_ID = "create-sequence-form";

export function SequenceListContainer() {
  const navigate = useNavigate();
  const canWrite = useSession()?.canWrite ?? false;
  const [startOpen, setStartOpen] = useState(false);
  const [startSequence, setStartSequence] = useState<SequenceRead | null>(null);
  const [startGroupId, setStartGroupId] = useState("");
  const list = useSequenceList({ groupsEnabled: canWrite && startOpen });
  const create = useCreateSequence();
  const { refetch } = list;
  const { setOpen: setCreateOpen } = create;

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onCreate = useCallback(() => setCreateOpen(true), [setCreateOpen]);

  const onStart = useCallback((sequence: SequenceRead) => {
    setStartSequence(sequence);
    setStartGroupId("");
    setStartOpen(true);
  }, []);

  const onConfirmStart = useCallback(() => {
    if (!startSequence || !startGroupId) return;

    setStartOpen(false);
    void navigate(
      `/groups/${encodeURIComponent(startGroupId)}/sequences?sequenceId=${encodeURIComponent(startSequence.id)}`,
    );
  }, [navigate, startGroupId, startSequence]);

  return (
    <SequenceListView
      rows={list.rows}
      loading={list.loading}
      error={list.error}
      retrying={list.retrying}
      onRetry={onRetry}
      canWrite={canWrite}
      onCreate={onCreate}
      onStart={onStart}
      createDialog={
        canWrite
          ? {
              open: create.open,
              onOpenChange: create.setOpen,
              form: {
                formId: CREATE_FORM_ID,
                register: create.register,
                errors: create.errors,
                steps: create.steps,
                submitting: create.submitting,
                onSubmit: create.submit,
              },
            }
          : null
      }
      startDialog={{
        open: startOpen,
        onOpenChange: setStartOpen,
        sequence: startSequence,
        groupOptions: list.groupOptions,
        groupsLoading: list.groupsLoading,
        groupId: startGroupId,
        onGroupChange: setStartGroupId,
        onConfirm: onConfirmStart,
      }}
    />
  );
}

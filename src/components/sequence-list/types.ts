import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { SequenceRead } from "@/services/sequence-service";

import type { CreateSequenceFormInput } from "./create-sequence-schema";

export type StepDefinitionRow = CreateSequenceFormInput["steps"][number];

/** 步骤行（hook 里 useFieldArray 的那一小片）：view 只渲染行、点加减。 */
export interface StepRows {
  fields: (StepDefinitionRow & { id: string })[];
  append: (row: StepDefinitionRow) => void;
  remove: (index: number) => void;
}

/** 新建序列表单：name + steps（accountRole / text / delaySeconds；index 由行位置派生）。 */
export interface CreateSequenceFormViewProps {
  formId: string;
  register: UseFormRegister<CreateSequenceFormInput>;
  errors: FieldErrors<CreateSequenceFormInput>;
  steps: StepRows;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface CreateSequenceDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateSequenceFormViewProps;
}

export interface StartSequenceDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 要启动的序列（关闭后保留，淡出期间标题不闪空）。 */
  sequence: SequenceRead | null;
  /** 能发言的群（状态正常）；显示名是网关群 ID。 */
  groupOptions: { value: string; label: string }[];
  groupsLoading: boolean;
  groupId: string;
  onGroupChange: (groupId: string) => void;
  onConfirm: () => void;
}

export interface SequenceRow {
  id: string;
  name: string;
  stepCount: number;
  /** 所有步骤里出现的占位符 key。 */
  placeholders: string[];
  /** 最后一步发出前的累计延迟（秒，不含各步发送耗时）。 */
  totalDelaySeconds: number;
  createdAt: string;
  sequence: SequenceRead;
}

export interface SequenceListViewProps {
  rows: SequenceRow[];
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  canWrite: boolean;
  onCreate: () => void;
  onStart: (sequence: SequenceRead) => void;
  createDialog: CreateSequenceDialogViewProps | null;
  startDialog: StartSequenceDialogViewProps;
}

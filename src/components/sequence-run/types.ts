import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { ResolveSequenceVarsResult } from "@/lib/sequence-vars";
import type { ConnectionStatus } from "@/lib/ws";
import type {
  SequenceRead,
  SequenceRunRead,
  SequenceStepDefinition,
} from "@/services/sequence-service";

import type {
  CreateSequenceFormInput,
  StartSequenceRunFormValues,
} from "./sequence-run-schema";

/** 可增删的行数组（hook 里 useFieldArray 的那一小片）：view 只渲染行、点加减。 */
export interface FormRows<Row> {
  fields: (Row & { id: string })[];
  append: (row: Row) => void;
  remove: (index: number) => void;
}

export type VarRow = StartSequenceRunFormValues["vars"][number];

export type StepVarRow = StartSequenceRunFormValues["stepVars"][number];

/**
 * 后端 422 UNRESOLVED_PLACEHOLDER 的定位 + 表单里要高亮的行（hook 在收到 422 时按当时的表单值算好：
 * useFieldArray 的 fields 是追加时的快照，view 自己按 fields 比对会漏掉后来才填的 key）。
 */
export interface ServerUnresolved {
  stepIndex: number;
  key: string;
  /** vars 里 key 相同的行下标。 */
  varRows: number[];
  /** stepVars 里同步且 key 相同的行下标。 */
  stepVarRows: number[];
}

/** 启动表单：选序列 + vars 行 + stepVars 行。 */
export interface SequenceFormViewProps {
  sequences: SequenceRead[];
  sequencesLoading: boolean;
  /**
   * 下拉当前的值（受控）：新建序列后 hook 会 setValue 选中它，而那时它的 <option> 可能还没渲染出来，
   * 非受控的原生 select 不会在选项出现后回填 —— 所以值由 hook 给、view 直接绑到 value。
   */
  selectedSequenceId: string;
  /** 当前下拉选中的序列的步骤（stepVars 的步骤下拉用）；没选时为空数组。 */
  selectedSteps: SequenceStepDefinition[];
  register: UseFormRegister<StartSequenceRunFormValues>;
  errors: FieldErrors<StartSequenceRunFormValues>;
  vars: FormRows<VarRow>;
  stepVars: FormRows<StepVarRow>;
  /** 后端 422 的定位：对应的 vars / stepVars 行高亮 + 顶部提示；null 无。 */
  serverUnresolved: ServerUnresolved | null;
  /** 群不可写（unreachable / left）或已有运行中的序列时整个表单禁用并给出原因；null 可启动。 */
  disabledReason: string | null;
  /** 把当前序列文本里出现、vars 里还没有的 key 追加成空行。 */
  onFillPlaceholders: () => void;
  /** 提交 = 本地预检 → 打开预检弹窗（不发请求）。 */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** 预检弹窗：每步每个 key 的最终取值与来源；本地解析不到的 key 标红并禁用启动。 */
export interface PreflightDialogViewProps {
  open: boolean;
  /** 关闭后仍保留上一次的结果（浮层淡出期间内容不能闪空），所以 open 与 result 是两个 state。 */
  result: ResolveSequenceVarsResult | null;
  starting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export interface SequenceRunProgressViewProps {
  run: SequenceRunRead | undefined;
  loading: boolean;
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}

export type StepDefinitionRow = CreateSequenceFormInput["steps"][number];

/** 新建序列的折叠表单：name + steps（accountRole / text / delaySeconds；index 由行位置派生）。 */
export interface CreateSequenceFormViewProps {
  register: UseFormRegister<CreateSequenceFormInput>;
  errors: FieldErrors<CreateSequenceFormInput>;
  steps: FormRows<StepDefinitionRow>;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface SequenceRunViewProps {
  groupId: string;
  connection: ConnectionStatus;
  /** 群详情：不可写的原因由容器算好放进 form.disabledReason，这里只要加载 / 错误态。 */
  groupLoading: boolean;
  groupError: unknown;
  groupRetrying: boolean;
  onGroupRetry: () => void;
  /** admin 才显示启动表单与新建序列（viewer 写操作 403）；为 null 时只展示进度。 */
  form: SequenceFormViewProps | null;
  preflight: PreflightDialogViewProps;
  /** 当前要展示进度的 run（刚启动的，或群里进行中的）；null 时不渲染进度卡。 */
  progress: SequenceRunProgressViewProps | null;
  createForm: CreateSequenceFormViewProps | null;
}

// 题目 B1 的取值规则，在前端本地复现（后端 src/services/sequence-service.ts 的 resolveVars 是同一套规则）：
// 预检弹窗要在调后端之前展示每步每个 key 的最终取值与来源。
//
// - 开始时的取值 = vars；vars 里的 "" 视为未提供。
// - 第 k 步在 stepVars[k] 里给了非空值 → 从这一步起后续都用新值，直到更晚的步再给；stepVars 里的 "" 表示这一步不改。
// - varSources：每个 key 来自 `default`（即 vars）还是 `step:<index>`（沿用时标最初给出它的那一步）。
// - 占位符 `{key}`，key 匹配 [A-Za-z0-9_]+。
//
// 与后端的一处刻意差异：后端抛第一个解析不到的（422 { stepIndex, key }），前端把**全部**解析不到的都列出来
// （弹窗里逐个标红），所以这里不抛错、返回 unresolved 列表。

export const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

export type VarMap = Readonly<Record<string, string>>;

/** stepVars：键是步骤 index 的十进制字符串。 */
export type StepVarMap = Readonly<Record<string, VarMap>>;

export type VarSource = "default" | `step:${number}`;

export interface ResolvedVarEntry {
  key: string;
  /** null = 本地解析不到。 */
  value: string | null;
  /** value 为 null 时也为 null。 */
  source: VarSource | null;
}

export interface ResolvedSequenceStep {
  index: number;
  /** 该步原文。 */
  text: string;
  /** 按 key 在文本里的出现顺序去重。 */
  entries: ResolvedVarEntry[];
  /** 全部 key 都解析到时的最终文本；否则解析不到的占位符原样保留。 */
  rendered: string;
}

export interface UnresolvedPlaceholderRef {
  stepIndex: number;
  key: string;
}

export interface ResolveSequenceVarsResult {
  steps: ResolvedSequenceStep[];
  /** 按步序、再按 key 在文本里的出现顺序；空数组 = 预检通过。 */
  unresolved: UnresolvedPlaceholderRef[];
}

/** 文本里出现的占位符 key，按出现顺序去重（与后端 extractPlaceholders 同口径）。 */
export function extractPlaceholders(text: string): string[] {
  const keys: string[] = [];

  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const key = match[1] as string;

    if (!keys.includes(key)) keys.push(key);
  }

  return keys;
}

/** 多步文本里出现的全部 key，按步序 + 出现顺序去重（表单的「填入占位符」用）。 */
export function collectPlaceholders(
  steps: ReadonlyArray<{ index: number; text: string }>,
): string[] {
  const keys: string[] = [];

  for (const step of [...steps].sort((a, b) => a.index - b.index)) {
    for (const key of extractPlaceholders(step.text)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  return keys;
}

/** 用最终取值替换 `{key}`；解析不到的原样保留。 */
export function renderTemplate(template: string, vars: VarMap): string {
  return template.replace(PLACEHOLDER_RE, (whole, key: string) =>
    Object.hasOwn(vars, key) ? vars[key]! : whole,
  );
}

export function resolveSequenceVars(
  steps: ReadonlyArray<{ index: number; text: string }>,
  vars: VarMap,
  stepVars: StepVarMap,
): ResolveSequenceVarsResult {
  const current: Record<string, string> = {};
  const source: Record<string, VarSource> = {};

  for (const [key, value] of Object.entries(vars)) {
    // vars 里的 "" 视为未提供
    if (value === "") continue;

    current[key] = value;
    source[key] = "default";
  }

  const ordered = [...steps].sort((a, b) => a.index - b.index);
  const out: ResolvedSequenceStep[] = [];
  const unresolved: UnresolvedPlaceholderRef[] = [];

  for (const step of ordered) {
    const overrides = stepVars[String(step.index)] ?? {};

    for (const [key, value] of Object.entries(overrides)) {
      // stepVars 里的 "" 表示这一步不改
      if (value === "") continue;

      current[key] = value;
      source[key] = `step:${step.index}`;
    }

    const entries: ResolvedVarEntry[] = [];
    const resolved: Record<string, string> = {};

    for (const key of extractPlaceholders(step.text)) {
      const value = current[key];

      if (value === undefined) {
        entries.push({ key, value: null, source: null });
        unresolved.push({ stepIndex: step.index, key });
        continue;
      }

      entries.push({ key, value, source: source[key]! });
      resolved[key] = value;
    }

    out.push({
      index: step.index,
      text: step.text,
      entries,
      rendered: renderTemplate(step.text, resolved),
    });
  }

  return { steps: out, unresolved };
}

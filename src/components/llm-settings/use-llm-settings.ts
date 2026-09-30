// LLM 设置这一条业务流（后端 #19；前端 #9）：
// 读当前生效配置（GET /api/llm/settings，响应只有 key 掩码，可以进 query 缓存）→ 选预设填 Base URL → 填 API Key
// → 获取模型列表（POST /api/llm/models）→ 选对话 / 审核模型 → 保存（PUT）→ 测试连接（POST /api/llm/test）。
//
// API key 明文只活在 RHF 表单状态里：
// - 获取模型列表与保存的请求体带 key，所以这两个调用用普通 async + useState 发，不用 useQuery（key 会进 queryKey）
//   也不用 useMutation（mutation 缓存会留着 variables）；
// - 不写 localStorage / sessionStorage、不打印；保存成功后整张表单按新配置 reset，key 输入框清空。
// viewer（canWrite=false）只读：容器不渲染表单，这里的写操作也不会被调用。
// supported=false（AGENT_URL 指向不支持在线配置的服务，如 Agent 模拟器）：所有写操作禁用。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { getLlmProvider, normalizeLlmBaseUrl } from "@/lib/llm-providers";
import { queryKeys } from "@/lib/query-keys";
import {
  getLlmErrorCode,
  getLlmSettings,
  LLM_AGENT_UNSUPPORTED_CODE,
  LLM_API_KEY_REQUIRED_CODE,
  LLM_UPSTREAM_ERROR_CODE,
  LLM_UPSTREAM_UNAUTHORIZED_CODE,
  listLlmModels,
  type LlmModel,
  saveLlmSettings,
  testLlmConnection,
} from "@/services/llm-settings-service";

import {
  API_KEY_REQUIRED_MESSAGE,
  baseUrlSchema,
  llmSettingsSchema,
  type LlmSettingsFormValues,
  needsNewApiKey,
  toListLlmModelsPayload,
  toLlmFormValues,
  toSaveLlmSettingsPayload,
  UNSUPPORTED_MESSAGE,
} from "./llm-settings-schema";

const LLM_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [LLM_UPSTREAM_UNAUTHORIZED_CODE]:
    "API Key 无效：服务商拒绝了这个 key，请检查后重新输入",
  [LLM_API_KEY_REQUIRED_CODE]:
    "需要重新输入 API Key：还没有保存过 key，或 Base URL 与已保存的不同，不能沿用",
  [LLM_UPSTREAM_ERROR_CODE]:
    "上游不可达：连不上服务商或服务商返回异常，请检查 Base URL 与网络",
  [LLM_AGENT_UNSUPPORTED_CODE]: UNSUPPORTED_MESSAGE,
};

/** 按错误码给中文提示；没有已知码的按通用出口（断网 / 超时 / 后端文案）。 */
export function describeLlmError(error: unknown, fallback: string): string {
  const code = getLlmErrorCode(error);

  return (code && LLM_ERROR_MESSAGES[code]) || getErrorMessage(error, fallback);
}

/** 这些错误是 key 本身的问题：标在 key 输入框上。 */
const KEY_ERROR_CODES = new Set([
  LLM_UPSTREAM_UNAUTHORIZED_CODE,
  LLM_API_KEY_REQUIRED_CODE,
]);

interface FetchedModels {
  /** 这份列表是用哪个 Base URL 拿到的（改了地址就提示重新获取）。 */
  baseUrl: string;
  items: LlmModel[];
}

export interface UseLlmSettingsOptions {
  /** viewer 为 false：只读展示。 */
  canWrite: boolean;
}

export function useLlmSettings({ canWrite }: UseLlmSettingsOptions) {
  const queryClient = useQueryClient();
  const [models, setModels] = useState<FetchedModels | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: queryKeys.llmSettings.detail(),
    queryFn: getLlmSettings,
    // 主查询：失败时整页渲染查询错误卡，不再弹 toast。
    meta: { silent: true },
  });
  const settings = settingsQuery.data;
  const supported = settings?.supported ?? true;
  const writable = canWrite && supported && settings !== undefined;

  // 已保存的配置到了（或变了）就灌进表单；keepDirtyValues：后台重拉不冲掉正在编辑的字段。
  const initialValues = useMemo(() => toLlmFormValues(settings), [settings]);
  const form = useForm<LlmSettingsFormValues>({
    resolver: zodResolver(llmSettingsSchema),
    defaultValues: initialValues,
    values: initialValues,
    resetOptions: { keepDirtyValues: true },
  });
  const { control, clearErrors, getValues, handleSubmit, reset, setError } =
    form;
  const setFormValue = form.setValue;
  const [providerId, baseUrl, model, auditModel] = useWatch({
    control,
    name: ["providerId", "baseUrl", "model", "auditModel"],
  });

  // 测试连接用已保存的配置、不带 key，可以走 useMutation。
  const testMutation = useMutation({ mutationFn: testLlmConnection });
  const { mutate: runTestMutation, reset: resetTest } = testMutation;

  const changeProvider = useCallback(
    (id: string) => {
      const preset = getLlmProvider(id);

      setFormValue("providerId", id, { shouldDirty: true });
      // 预设没有核实过的地址（自定义）→ 清空让用户自己填。
      setFormValue("baseUrl", preset?.baseUrl ?? "", { shouldDirty: true });
      // 换了服务商，旧列表与旧的模型选择都不再适用。
      setFormValue("model", "", { shouldDirty: true });
      setFormValue("auditModel", "", { shouldDirty: true });
      clearErrors(["baseUrl", "apiKey", "model"]);
      setModels(null);
      setModelsError(null);
    },
    [clearErrors, setFormValue],
  );

  const setModel = useCallback(
    (value: string) =>
      setFormValue("model", value, { shouldDirty: true, shouldValidate: true }),
    [setFormValue],
  );

  const setAuditModel = useCallback(
    (value: string) => setFormValue("auditModel", value, { shouldDirty: true }),
    [setFormValue],
  );

  const fetchModels = useCallback(async () => {
    if (!writable) return;

    const values = getValues();
    const parsedUrl = baseUrlSchema.safeParse(values.baseUrl);

    setModelsError(null);

    if (!parsedUrl.success) {
      setError("baseUrl", { message: parsedUrl.error.issues[0]?.message });

      return;
    }

    clearErrors("baseUrl");

    if (!values.apiKey.trim() && needsNewApiKey(parsedUrl.data, settings)) {
      setError("apiKey", { message: API_KEY_REQUIRED_MESSAGE });

      return;
    }

    clearErrors("apiKey");
    setModelsLoading(true);

    try {
      const result = await listLlmModels(
        toListLlmModelsPayload(parsedUrl.data, values.apiKey),
      );

      setModels({ baseUrl: parsedUrl.data, items: result.items });
    } catch (error) {
      const message = describeLlmError(error, "获取模型列表失败");
      const code = getLlmErrorCode(error);

      // key 的问题只标在 key 输入框上（不再在按钮下重复一遍）；其它错误显示在按钮下方。
      if (code && KEY_ERROR_CODES.has(code))
        setError("apiKey", { message }, { shouldFocus: true });
      else setModelsError(message);
    } finally {
      setModelsLoading(false);
    }
  }, [clearErrors, getValues, setError, settings, writable]);

  const onValid = useCallback(
    async (values: LlmSettingsFormValues) => {
      if (!writable) return;

      if (!values.apiKey && needsNewApiKey(values.baseUrl, settings)) {
        setError("apiKey", { message: API_KEY_REQUIRED_MESSAGE });

        return;
      }

      setSaving(true);

      try {
        const saved = await saveLlmSettings(toSaveLlmSettingsPayload(values));

        queryClient.setQueryData(queryKeys.llmSettings.detail(), saved);
        // 整张表单回到「已保存」的状态：key 输入框清空。useForm 的 resetOptions 会并进每一次 reset()，
        // 这里必须显式关掉 keepDirtyValues，否则填过的 key 是 dirty 字段、会被原样留下。
        reset(toLlmFormValues(saved), { keepDirtyValues: false });
        resetTest();
        toast.success("LLM 配置已保存");
      } catch (error) {
        const message = describeLlmError(error, "保存失败，请重试");
        const code = getLlmErrorCode(error);

        if (code && KEY_ERROR_CODES.has(code))
          setError("apiKey", { message }, { shouldFocus: true });

        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [queryClient, reset, resetTest, setError, settings, writable],
  );

  const runTest = useCallback(() => {
    if (!writable) return;

    runTestMutation();
  }, [runTestMutation, writable]);

  // 下拉的选项：拿到的列表 + 当前已选的值（没重新获取时也能看到已保存的模型）。
  const modelOptions = useMemo(() => {
    const ids = new Set(models?.items.map((item) => item.id) ?? []);

    for (const value of [model, auditModel]) if (value) ids.add(value);

    return [...ids];
  }, [auditModel, model, models]);

  const modelsStale =
    models !== null &&
    normalizeLlmBaseUrl(models.baseUrl) !== normalizeLlmBaseUrl(baseUrl);

  return {
    settings,
    loading: settingsQuery.isPending,
    error: settingsQuery.error,
    retrying: settingsQuery.isFetching,
    refetch: settingsQuery.refetch,
    supported,
    writable,
    register: form.register,
    errors: form.formState.errors,
    providerId,
    changeProvider,
    model,
    auditModel,
    setModel,
    setAuditModel,
    modelOptions,
    modelsFetched: models !== null,
    modelsCount: models?.items.length ?? 0,
    modelsStale,
    modelsLoading,
    modelsError,
    fetchModels,
    saving,
    submit: handleSubmit(onValid),
    testing: testMutation.isPending,
    testResult: testMutation.data ?? null,
    testError: testMutation.error
      ? describeLlmError(testMutation.error, "测试连接失败")
      : null,
    runTest,
  };
}

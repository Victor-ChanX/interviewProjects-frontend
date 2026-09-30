// 登录这一条业务流：表单（RHF + zod）→ login() → 写会话（src/lib/auth.ts）→ 回 next。
// 失败不 toast：整句提示（错误信封的 error.message）由 mutation.error 派生，留在表单里展示。

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { setAccessToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/get-error-message";
import { login } from "@/services/auth-service";

import { type LoginFormValues, loginSchema } from "./login-schema";

/**
 * @param next 登录成功后的落点（容器已用 safeNextPath 收窄成站内路径）。
 */
export function useLogin(next: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values),
  });
  const { mutate } = mutation;

  const onValid = useCallback(
    (values: LoginFormValues) => {
      mutate(values, {
        onSuccess: ({ accessToken }) => {
          setAccessToken(accessToken);
          // 换账号登录：上一位用户的缓存（按角色可见的数据）不能带进新会话。
          queryClient.clear();
          void navigate(next, { replace: true });
        },
      });
    },
    [mutate, navigate, next, queryClient],
  );

  return {
    register: form.register,
    errors: form.formState.errors,
    submit: form.handleSubmit(onValid),
    pending: mutation.isPending,
    errorMessage: mutation.error
      ? getErrorMessage(mutation.error, "登录失败，请重试")
      : null,
  };
}

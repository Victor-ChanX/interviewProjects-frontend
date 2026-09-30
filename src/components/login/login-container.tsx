// container：路由参数（next）、登录态分支、hook 编排；渲染就绪的数据与回调通过 props 交给 view。

import { Navigate, useSearchParams } from "react-router";

import { useSession } from "@/hooks/use-session";
import { safeNextPath } from "@/lib/login-redirect";

import { LoginView } from "./login-view";
import { useLogin } from "./use-login";

export function LoginContainer() {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const session = useSession();
  const login = useLogin(next);

  // 已登录（刷新页面、或手动打开 /login）：不再展示表单，直接回落点。
  if (session) return <Navigate to={next} replace />;

  return (
    <LoginView
      register={login.register}
      errors={login.errors}
      errorMessage={login.errorMessage}
      pending={login.pending}
      onSubmit={login.submit}
    />
  );
}

import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { LoginFormValues } from "./login-schema";

export interface LoginViewProps {
  register: UseFormRegister<LoginFormValues>;
  errors: FieldErrors<LoginFormValues>;
  /** 提交失败的整句提示（错误信封的 error.message，或断网 / 超时的中文兜底）；null 不显示。 */
  errorMessage: string | null;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

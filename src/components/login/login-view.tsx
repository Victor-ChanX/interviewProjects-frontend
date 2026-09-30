// view：纯展示，props 进回调出。不 fetch、不 toast、不做路由、不碰 storage。

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { LoginViewProps } from "./types";

export function LoginView({
  register,
  errors,
  errorMessage,
  pending,
  onSubmit,
}: LoginViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>多账号群组消息平台 · 控制台</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-username">用户名</Label>
              <Input
                id="login-username"
                autoComplete="username"
                autoFocus
                aria-invalid={errors.username ? true : undefined}
                {...register("username")}
              />
              {errors.username?.message ? (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">密码</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              {errors.password?.message ? (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? "登录中…" : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

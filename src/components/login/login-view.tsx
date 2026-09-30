// view：登录页。宽屏左右各半 —— 左侧整块主色讲清楚平台是做什么的，右侧浅灰蓝底上一张登录卡片；
// 窄屏（< lg）只留卡片。纯展示，props 进回调出；没有注册入口（账号由管理员分配）。

import {
  AlertCircle,
  Bot,
  CalendarClock,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { LoginViewProps } from "./types";

const CAPABILITIES = [
  {
    icon: UsersRound,
    title: "账号托管与状态机",
    text: "多个服务账号统一接入网关，在线 / 限流 / 离线 / 停用按状态机流转，并发操作不打架。",
  },
  {
    icon: ShieldCheck,
    title: "可靠投递",
    text: "出站消息至少一次送达、按客户端消息号去重，超时结果未知时先确认再重发。",
  },
  {
    icon: CalendarClock,
    title: "定时序列",
    text: "按步骤与延迟由管理员 / 成员账号依次发言，占位符启动前预检。",
  },
  {
    icon: Bot,
    title: "AI 群助手（Claude / Gemini）",
    text: "外部成员发言即触发 Agent 应答与成员管理，每一步工具调用都经审计。",
  },
] as const;

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function LoginView({
  register,
  errors,
  errorMessage,
  pending,
  onSubmit,
}: LoginViewProps) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="relative hidden flex-col overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex xl:px-16">
        {/* 背景的两个大圆只是装饰。 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary-foreground/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-primary-foreground/5"
        />

        <div className="relative flex items-center gap-2 text-sm font-medium text-primary-foreground/85">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary-foreground/15">
            <MessagesSquare className="size-4" />
          </span>
          群组消息平台
        </div>

        <div className="relative my-auto flex max-w-xl flex-col gap-10 py-12">
          <div className="relative">
            <p
              aria-hidden
              className="pointer-events-none absolute -top-9 left-0 text-4xl leading-none font-bold tracking-tight whitespace-nowrap text-primary-foreground/10 select-none 2xl:text-5xl"
            >
              Multi-Account Group Messaging
            </p>
            <h1 className="relative text-4xl leading-tight font-bold tracking-tight xl:text-5xl">
              多账号群组消息平台
            </h1>
            <p className="relative mt-4 text-base leading-relaxed text-primary-foreground/80">
              代管服务账号接入消息网关，把群消息记成可靠时间线，按定时序列发言，并由
              AI 群助手自动应答与管理成员。
            </p>
          </div>

          <ul className="flex flex-col gap-5">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
                  <Icon className="size-5" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm leading-relaxed text-primary-foreground/75">
                    {text}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-center text-xs text-primary-foreground/60">
          © 2026 群组消息平台
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary lg:hidden">
            <MessagesSquare className="size-5" />
            多账号群组消息平台
          </div>

          <div className="rounded-2xl bg-card p-8 shadow-xl ring-1 shadow-primary/5 ring-foreground/5">
            <div className="mb-6 flex flex-col gap-1.5 text-center">
              <h2 className="text-xl font-semibold tracking-tight">
                控制台登录
              </h2>
              <p className="text-sm text-muted-foreground">使用平台账号登录</p>
            </div>

            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={onSubmit}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-username">用户名</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-username"
                    autoComplete="username"
                    autoFocus
                    placeholder="请输入用户名"
                    className="h-10 pl-9"
                    aria-invalid={errors.username ? true : undefined}
                    {...register("username")}
                  />
                </div>
                <FieldError message={errors.username?.message} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password">密码</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="请输入密码"
                    className="h-10 pl-9"
                    aria-invalid={errors.password ? true : undefined}
                    {...register("password")}
                  />
                </div>
                <FieldError message={errors.password?.message} />
              </div>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="mt-2 h-10 w-full"
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : null}
                {pending ? "登录中…" : "登录"}
              </Button>
            </form>

            <p className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
              演示账号：admin / admin（管理）· viewer / viewer（只读）
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

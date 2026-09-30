// 端到端测试（前端 #8，题目 C3）：`npm run e2e`。Playwright 自己拉起四个进程再跑 e2e/*.spec.ts：
//   ① 消息网关模拟器  ② Agent 服务模拟器  ③ 后端（迁移 + 种子 + worker）  ④ Vite（/api、/ws 代理到 ③）。
// ①②③ 来自并排 checkout 的后端仓（e2e/env.ts 的 BACKEND_DIR），命令都是它的 npm 脚本。
// 端口、URL、数据库连接串的取法都在 e2e/env.ts，只在那一处改。
//
// 与单测的边界：vitest（src/**/*.test.ts）全在内存里、不发请求；这里是真浏览器 + 真后端 + 真 Postgres，
// 只覆盖「登录 → 打开群 → 看到 agent run 的步骤」这条主链路与 viewer 只读，不在这里重复断言纯函数。
//
// 本地：reuseExistingServer 为真 —— 这几个端口上已经有进程就直接用（例如你手动起了后端调试）；
// CI 里为假，端口被占直接报错，免得跑在不知道是谁的进程上。
// 后端进程每次被拉起前都先重建专用库（e2e/reset-db.mts，原因写在那里）；复用已在跑的后端时不重建。

import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import {
  AGENT_URL,
  BACKEND_DIR,
  BACKEND_URL,
  GATEWAY_URL,
  PORTS,
  resolveDatabaseUrl,
  resolveJwtSecret,
  WEB_URL,
} from "./e2e/env";

const reuseExistingServer = !process.env.CI;
const resetDbScript = path.join(import.meta.dirname, "e2e/reset-db.mts");

export default defineConfig({
  testDir: "e2e",
  // 用例共用同一套后端状态（acc-1 / acc-2、专用库），串行跑。
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Vite 首次编译 + 后端 job / agent worker 的轮询都要几秒，单条用例给足一分钟。
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run sim:gateway",
      cwd: BACKEND_DIR,
      url: `${GATEWAY_URL}/_sim/state`,
      env: { SIM_GATEWAY_PORT: String(PORTS.gateway) },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      command: "npm run sim:agent",
      cwd: BACKEND_DIR,
      url: `${AGENT_URL}/_sim/state`,
      env: { SIM_AGENT_PORT: String(PORTS.agent) },
      reuseExistingServer,
      timeout: 60_000,
    },
    {
      // 先重建专用库再起后端；后端启动时自己前滚迁移、跑幂等种子。
      command: `node "${resetDbScript}" && npm run dev`,
      cwd: BACKEND_DIR,
      url: `${BACKEND_URL}/api/health`,
      env: {
        PORT: String(PORTS.backend),
        DATABASE_URL: resolveDatabaseUrl(),
        JWT_SECRET: resolveJwtSecret(),
        GATEWAY_URL,
        AGENT_URL,
      },
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      // --strictPort：端口被占就失败，而不是悄悄换端口让 baseURL 指空。
      command: `npm run dev -- --port ${PORTS.web} --strictPort`,
      url: WEB_URL,
      env: { VITE_API_PROXY: BACKEND_URL },
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
});

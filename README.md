# 多账号群组消息平台 · 控制台

React 18 + TypeScript + Vite + TanStack Query + shadcn（Base UI）。后端在
[interviewProjects-backend](https://github.com/Victor-ChanX/interviewProjects-backend)，
项目规划见[后端仓的 docs/plan.md](https://github.com/Victor-ChanX/interviewProjects-backend/blob/main/docs/plan.md)。

## 本地跑起来

前提：**Node ≥ 22.18**；后端已按[后端仓 README「本地跑起来」](https://github.com/Victor-ChanX/interviewProjects-backend#本地跑起来)
在 http://localhost:8000 跑着（两个模拟器 + 后端）。

```bash
cp .env.example .env    # VITE_API_PROXY=http://localhost:8000：开发时 /api 与 /ws 转发到后端
npm install
npm run dev             # http://localhost:5173
```

用 `admin / admin`（全部权限）或 `viewer / viewer`（只读）登录。没有 .env（没设 `VITE_API_PROXY`）时请求走同源相对路径、
到不了后端 —— 登录页一上来就报错先查这个；登录报 HTTP 500 多半是后端没起来（Vite 代理连不上 8000）。

页面（路由登记在 `src/app/router.tsx`）：

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 工作台 | `/dashboard` | 账号 / 群 / 今日消息 / Agent 运行 / 序列的计数，需要处理的事项，实时动态 |
| 账号管理 | `/accounts` | 五个服务账号的状态与合法转移（连接、标记离线、释放…） |
| 群组管理 · 群详情 | `/groups`、`/groups/:groupId` | 建群 / 全部退群（带进度）；消息时间线（实时、加载更早）与发送；成员；Agent 运行；Agent 开关；演示用「模拟外部发言」 |
| 序列运行 | `/groups/:groupId/sequences` | 选序列、填变量 → 预检弹窗 → 启动；运行进度 |
| 定时序列 | `/sequences` | 序列定义列表与新建 |
| Agent 运行 · 详情 | `/agent-runs`、`/agent-runs/:runId` | 全部运行；每一步的 kind、工具、入参、结果、审计结论、错误码，协议错误步的原始响应 |
| 实时动态 · 异常中心 | `/activity`、`/inconsistencies` | 平台事件流；未知群消息、入站处理失败、退群对账不一致 |
| 模型设置 | `/settings/llm` | 真实 LLM 版 Agent 的服务商、API Key、模型（后端 `AGENT_URL` 指向 llm-agent 时可用） |

实时更新走 WebSocket（`/ws`，断线自动重连并按 seq 补发）；时间一律按**浏览器所在时区**显示，工作台的「今日」也按它统计。

## 测试与检查

```bash
npm test                # vitest：纯函数、schema、service wrapper 与 hook（renderHook），全在内存里、不发请求
npm run test:coverage   # CI 跑这个，行覆盖率地板见 vitest.config.mts
npm run build           # tsc --noEmit && vite build（Vite 本身不做类型检查）
npm run lint            # eslint（含分层约束）；npm run format:check 查 Prettier
```

CI 跑 `tsc --noEmit`、`npm run lint`、`npm run format:check`、`npm run test:coverage`、`npm run build`，以及上面的 e2e。

## 端到端（Playwright，前端 #8 / 题目 C3）

用真浏览器走「登录 → 群列表 → 群详情（成员 + agent run 列表）→ run 详情看到每一步（kind / 工具名 / 审计结论）」，
外加一条 viewer 只读。单测（vitest）全在内存里、不发请求，这条链路只能在这里验。

前提：后端仓与本仓**并排 checkout**（`../interviewProjects-backend`，已 `npm install`）、本机 PostgreSQL 且 `psql` 在 PATH。

```bash
npm run e2e        # = playwright test；首次先 npx playwright install chromium
```

`playwright.config.ts` 的 `webServer` 会自己拉起四个进程再跑用例：网关模拟器 :18100、Agent 模拟器 :18200、
后端 :18000、Vite :15173（`/api`、`/ws` 代理到 :18000）。端口刻意不用默认值，不会撞上你正在开发的进程；
数字只在 `e2e/env.ts` 一处。本地这几个端口上已有进程就直接复用（`reuseExistingServer`），CI 里端口被占直接报错。

- **数据库**：专用库 `interview_e2e`，后端进程每次被拉起前由 `e2e/reset-db.mts` 删掉重建（库名必须含 `e2e`，
  写错也删不到开发库），后端启动时自动迁移 + 种子。连接串优先级：`E2E_DATABASE_URL` → 后端仓 .env 里的
  `DATABASE_URL` 换库名 → `postgres://<当前用户>@localhost:5432/interview_e2e`。为什么每次重建而不是累积：
  网关模拟器的 eventId 在内存里从 1 递增，后端却把见过的 eventId 记在库里，网关重启后新事件会被当成重复推送丢掉，
  run 永远不触发；库与网关一起从零开始才没有这条缝（所以用例也不 `POST /_sim/reset` 网关，只 reset Agent 模拟器）。
  没有 `psql`、或想自己管库：`E2E_SKIP_DB_RESET=1`。
- **数据准备**：`e2e/agent-run.spec.ts` 的 `beforeAll` 经 API 与模拟器管理端点造数（连 acc-1 / acc-2 → 建群、
  轮询 job → 开 `agentEnabled` → 网关 `POST /_sim/push` 推一条外部用户消息 → 轮询到 run finished），UI 只走「看」。
  复用手动起的后端时账号可能已经 online，会先标记离线再 connect。
- **失败排查**：`test-results/` 里有失败用例的截图与 trace（`npx playwright show-trace <trace.zip>`），
  CI 另出 `playwright-report/`；两者都在 `.gitignore`。
- **CI**：`.github/workflows/ci.yml` 的 e2e 任务同时 checkout 后端仓到并排目录、起一个 Postgres service
  （`E2E_DATABASE_URL` 指过去，库名含 `e2e`）、两边都 `npm ci`，再 `npx playwright install --with-deps chromium` → `npm run e2e`；
  失败时上传 `playwright-report/` 与 `test-results/`。

## 部署（Docker / Dokploy）

`Dockerfile` 构建出一个 nginx 镜像：托管 `npm run build` 的静态页，并把 `/api`、`/ws` 反代到后端
（配置在 [`deploy/nginx.conf.template`](deploy/nginx.conf.template)）。浏览器只和本站同源通信，
所以后端不用配 CORS，登录用的 refresh cookie 也落在本站域名下。

唯一的运行时变量是 `BACKEND_URL`：后端的地址，只写协议和主机（如 `https://api.example.com`，不带路径和末尾 `/`）。
没设或格式不对时容器启动即失败，日志里说明原因。

在 Dokploy 上：

1. 先按后端仓的[部署文档](https://github.com/Victor-ChanX/interviewProjects-backend/blob/main/docs/deploy.md)
   部署后端，并给后端配好域名。
2. Create Service → Application，仓库选本仓、分支 `main`，Build Type 选 Dockerfile（路径 `./Dockerfile`）。
3. Environment 填 `BACKEND_URL=https://<后端域名>`。
4. Domains 加前端域名，Container Port `80`，HTTPS 选 Let's Encrypt；Deploy。

本机：`docker build -t gmp-web . && docker run --rm -p 8080:80 -e BACKEND_URL=http://host.docker.internal:8000 gmp-web`，
打开 http://localhost:8080 。

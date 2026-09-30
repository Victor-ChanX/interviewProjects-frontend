# 多账号群组消息平台 · 控制台

React 18 + TypeScript + Vite。后端在 [interviewProjects-backend](https://github.com/Victor-ChanX/interviewProjects-backend)，
项目规划见 [后端仓的 docs/plan.md](https://github.com/Victor-ChanX/interviewProjects-backend/blob/main/docs/plan.md)。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173，/api 代理到 VITE_API_PROXY（默认 http://localhost:8000）
npm test
npm run build      # tsc --noEmit && vite build
```

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
- **CI 接入**：公开 CI 要同时 checkout 后端仓到并排目录（`actions/checkout` 加 `path` + `repository`）、起一个
  Postgres service（`E2E_DATABASE_URL` 指过去，库名含 `e2e`）、两边都 `npm ci`，再 `npx playwright install --with-deps chromium`
  → `npm run e2e`。现在的 `.github/workflows/ci.yml` 还没接这一步。

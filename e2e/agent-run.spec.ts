// 端到端（前端 #8，题目 C3；前端 #12 改版后同步）：登录 → 工作台 → 左侧菜单进群组管理 → 群详情
// （成员页签 + Agent 运行页签）→ run 详情看到每一步。
//
// 数据不经 UI 造：beforeAll 用 Playwright 的 request 直接调后端 API 与模拟器管理端点 ——
// 连 acc-1 / acc-2 → 建群（轮询 job 到 finished）→ 开 agentEnabled → 网关推一条外部用户消息触发 run
// → 轮询到 run finished。UI 部分只走「看」的路径：这是题目要的链路，也是最不容易被时序干扰的写法。
//
// 幂等：Playwright 拉起后端前会重建专用库（e2e/reset-db.mts），所以正常情况下账号都是 idle；
// 复用手动起的后端（reuseExistingServer）时账号可能已经 online，先看状态再决定要不要先断开。
// 群每次新建；Agent 模拟器每次 /_sim/reset。网关模拟器**不** reset：它的 eventId 会归零，而后端
// 的 inbound_events / event_cursor 还在，新事件会被当成重复推送丢掉（详见 reset-db.mts 文件头）。
// 网关的账号 / 群只在内存里累积，不影响断言。

import { expect, test, type APIRequestContext } from "@playwright/test";

import type { components } from "@/types/api.generated";

import { AGENT_URL, BACKEND_URL, GATEWAY_URL } from "./env";

type AccountRead = components["schemas"]["AccountRead"];
type AccountStatus = components["schemas"]["AccountStatus"];
type JobRead = components["schemas"]["JobRead"];
type GroupRead = components["schemas"]["GroupRead"];
type AgentRunRead = components["schemas"]["AgentRunRead"];
type AgentRunList = components["schemas"]["AgentRunListResponse"];

const ADMIN = { username: "admin", password: "admin" };
const VIEWER = { username: "viewer", password: "viewer" };
/** 种子账号里拿两个：acc-1 建群，acc-2 入群。 */
const CREATOR = "acc-1";
const MEMBER = "acc-2";
/** 外部用户（不是任何服务账号的 platformUserId），它的消息才会触发 agent（A5 第 1 条）。 */
const EXTERNAL_USER = "u-ext-e2e";

const POLL_INTERVAL_MS = 300;
const JOB_DEADLINE_MS = 30_000;
const RUN_DEADLINE_MS = 45_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 带 Bearer 的后端 API 调用：非 2xx 直接抛，把状态码与信封带出来。 */
class Api {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  static async login(
    request: APIRequestContext,
    credentials: { username: string; password: string },
  ): Promise<Api> {
    const res = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: credentials,
    });

    expect(res.ok(), `login ${credentials.username}: ${res.status()}`).toBe(
      true,
    );

    const { accessToken } = (await res.json()) as { accessToken: string };

    return new Api(request, accessToken);
  }

  async call<T>(
    method: "get" | "post" | "patch",
    path: string,
    data?: unknown,
  ): Promise<T> {
    const res = await this.request[method](`${BACKEND_URL}${path}`, {
      headers: { authorization: `Bearer ${this.token}` },
      ...(data === undefined ? {} : { data }),
    });

    if (!res.ok()) {
      throw new Error(
        `${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`,
      );
    }

    return (await res.json()) as T;
  }
}

/**
 * 把账号弄到 online：idle / disconnected 直接 connect；online / rate_limited 先标记离线再 connect
 * （复用旧后端时账号可能仍是 online，但网关模拟器不一定还认识它 —— 断开再连一次最稳）；
 * 终态（suspended / session_expired）无法恢复，让用例带着原因失败。
 */
async function ensureOnline(api: Api, id: string): Promise<AccountRead> {
  const accounts = await api.call<AccountRead[]>("get", "/api/accounts");
  const account = accounts.find((item) => item.id === id);

  if (!account) throw new Error(`种子账号 ${id} 不存在：后端启动时应已种下`);

  const reconnectable: AccountStatus[] = ["online", "rate_limited"];

  if (reconnectable.includes(account.status)) {
    await api.call("post", `/api/accounts/${id}/transition`, {
      to: "disconnected",
      expectedFrom: account.status,
    });
  } else if (account.status !== "idle" && account.status !== "disconnected") {
    throw new Error(
      `账号 ${id} 处于终态 ${account.status}，重建 e2e 库后再跑（e2e/reset-db.mts）`,
    );
  }

  return api.call<AccountRead>("post", `/api/accounts/${id}/connect`);
}

async function createGroupAndWait(api: Api): Promise<GroupRead> {
  const { jobId } = await api.call<{ jobId: string }>("post", "/api/groups", {
    creatorAccountId: CREATOR,
    memberAccountIds: [MEMBER],
  });
  const deadline = Date.now() + JOB_DEADLINE_MS;

  for (;;) {
    const job = await api.call<JobRead>("get", `/api/jobs/${jobId}`);

    if (job.status === "finished" && job.groupId) {
      return api.call<GroupRead>("get", `/api/groups/${job.groupId}`);
    }

    if (job.status === "failed") {
      throw new Error(`建群 job ${jobId} 失败：${JSON.stringify(job.errors)}`);
    }

    if (Date.now() > deadline) {
      throw new Error(`建群 job ${jobId} 超时，仍在 ${job.step}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

async function waitForFinishedRun(
  api: Api,
  groupId: string,
): Promise<AgentRunRead> {
  const deadline = Date.now() + RUN_DEADLINE_MS;

  for (;;) {
    const { items } = await api.call<AgentRunList>(
      "get",
      `/api/groups/${groupId}/agent-runs`,
    );
    const finished = items.find((run) => run.status === "finished");

    if (finished) return finished;

    const terminal = items.find((run) => run.status !== "running");

    if (terminal) {
      throw new Error(
        `agent run ${terminal.id} 以 ${terminal.status}（${terminal.endReason}）结束：${terminal.summary}`,
      );
    }

    if (Date.now() > deadline) {
      throw new Error(
        `群 ${groupId} 在 ${RUN_DEADLINE_MS}ms 内没有 finished 的 agent run（现有 ${items.length} 条）`,
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

let group: GroupRead;
let run: AgentRunRead;

test.beforeAll(async ({ request }) => {
  // Agent 模拟器回到默认剧本：get_recent_messages → send_message → finish，审计一律 pass。
  const agentReset = await request.post(`${AGENT_URL}/_sim/reset`);

  expect(agentReset.ok()).toBe(true);

  const api = await Api.login(request, ADMIN);

  await ensureOnline(api, CREATOR);
  await ensureOnline(api, MEMBER);

  const created = await createGroupAndWait(api);

  group = await api.call<GroupRead>("patch", `/api/groups/${created.id}`, {
    agentEnabled: true,
  });
  expect(group.agentEnabled).toBe(true);
  expect(group.gatewayGroupId).not.toBeNull();

  // 外部用户在网关侧发一条消息 → SSE 进后端 → 触发 run。
  const pushed = await request.post(`${GATEWAY_URL}/_sim/push`, {
    data: {
      kind: "message",
      groupId: group.gatewayGroupId,
      senderPlatformUserId: EXTERNAL_USER,
      text: "有人吗？",
    },
  });

  expect(pushed.ok(), await pushed.text()).toBe(true);

  run = await waitForFinishedRun(api, group.id);
});

test("登录 → 打开群 → 看到 agent run 的每一步", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(ADMIN.username);
  await page.getByLabel("密码").fill(ADMIN.password);
  await page.getByRole("button", { name: "登录" }).click();

  // 登录成功落在工作台（DEFAULT_AFTER_LOGIN）。
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(page.getByTestId("dashboard-stats")).toBeVisible();

  // 左侧菜单 → 群组管理（客户端路由，不整页刷新）。
  await page.getByRole("link", { name: "群组管理" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole("heading", { name: "群组管理" })).toBeVisible();

  // 群在列表里以网关群 ID 显示，本身是进群详情的链接。
  const gatewayGroupId = group.gatewayGroupId ?? "";

  await page
    .getByTestId("group-table")
    .getByRole("link", { name: gatewayGroupId, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/groups/${group.id}$`));
  await expect(
    page.getByRole("heading", { name: gatewayGroupId }),
  ).toBeVisible();

  // 成员页签：acc-1 是群主；acc-2 入群后被建群 job 提成管理员（#11），角色列显示「管理员」。
  await page.getByRole("tab", { name: /成员/ }).click();

  const members = page.getByTestId("member-table");
  const memberRow = (accountId: string) =>
    members.getByRole("row").filter({
      has: page.getByRole("cell", { name: accountId, exact: true }),
    });

  await expect(memberRow(CREATOR)).toContainText("群主");
  await expect(memberRow(MEMBER)).toContainText("管理员");

  // Agent 运行页签：那条 finished 的 run 在（表里显示缩写的 id，完整 id 在链接的 data-run-id 上），点进去。
  await page.getByRole("tab", { name: /Agent 运行/ }).click();

  const runs = page.getByTestId("agent-run-list");
  // has 里的定位器按行内相对查找，所以从 page 起，不从 runs 起。
  const runLink = page.locator(`a[data-run-id="${run.id}"]`);
  const runRow = runs.getByRole("row").filter({ has: runLink });

  await expect(runRow).toContainText("已完成");
  await runLink.click();

  await expect(page).toHaveURL(new RegExp(`/agent-runs/${run.id}$`));
  await expect(page.getByRole("heading", { name: run.id })).toBeVisible();
  await expect(page.getByTestId("agent-run-status")).toHaveText("已完成");

  // 步骤表：默认剧本的三步，kind / 工具名 / 审计结论都对。
  const steps = page.getByTestId("agent-step-table");
  const step = (name: string) =>
    steps
      .getByRole("row")
      .filter({ has: page.getByText(name, { exact: true }) });

  await expect(step("get_recent_messages")).toContainText("工具调用");
  await expect(step("send_message")).toContainText("工具调用");
  await expect(step("send_message")).toContainText("通过");
  await expect(step("finish")).toContainText("结束");
  await expect(steps.getByRole("row")).toHaveCount(4); // 表头 + 三步
});

test("viewer 登录后账号页没有写操作按钮", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(VIEWER.username);
  await page.getByLabel("密码").fill(VIEWER.password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  // 侧栏底部的当前用户显示角色「只读」。
  await expect(page.getByText("只读", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "账号管理" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  // 表已经渲染出行了（不是 loading 骨架），再断言没有按钮才有意义。
  await expect(
    page.getByRole("cell", { name: CREATOR, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /标记离线|重连|释放账号/ }),
  ).toHaveCount(0);
});

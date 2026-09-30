// 端到端专用库的重建（前端 #8）：DROP DATABASE … WITH (FORCE) 再 CREATE，然后由后端启动时的
// 迁移 + 幂等种子把表和 acc-1…acc-5 / admin / viewer 铺好。playwright.config.ts 把它接在后端
// webServer 的命令前面（`node e2e/reset-db.mts && npm run dev`），所以**后端进程每次由 Playwright
// 拉起时库都是新的**。
//
// 为什么必须重建而不是「群每次新建、数据累积」：网关模拟器的 eventId 从 1 递增、只在内存里，
// 而后端把已处理的 eventId 记在 inbound_events（唯一）、游标记在 event_cursor。网关重启（或
// POST /_sim/reset）后 eventId 又从 1 开始，旧库里 1…N 都「见过」，新事件会被当成重复推送整条
// 丢掉 —— 外部消息进不来、agent run 永远不触发。库与网关一起从零开始才没有这个缝。
//
// 安全阀：库名不含 e2e 一律拒绝（E2E_DATABASE_URL 写错也不会删掉开发库）。
// E2E_SKIP_DB_RESET=1 跳过（自己管库、或没有 psql 客户端时），此时要自己保证库与网关一起是新的。
//
// 用 Node 原生类型剥离运行（Node ≥ 22.18，与 scripts/*.mts 同一口径），只依赖 psql 客户端。

import { execFileSync } from "node:child_process";

function psql(url: URL, sql: string): void {
  execFileSync(
    "psql",
    [url.toString(), "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
    {
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
}

function main(): void {
  if (process.env.E2E_SKIP_DB_RESET === "1") {
    console.log("reset-db: E2E_SKIP_DB_RESET=1，跳过重建");

    return;
  }

  const raw = process.env.DATABASE_URL;

  if (!raw)
    throw new Error("reset-db: 缺 DATABASE_URL（playwright.config.ts 会传）");

  const target = new URL(raw);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));

  if (!/e2e/i.test(dbName)) {
    throw new Error(
      `reset-db: 拒绝重建 "${dbName}" —— 库名必须含 e2e，免得删掉开发库（E2E_DATABASE_URL）`,
    );
  }

  // 连维护库 postgres 执行 DROP / CREATE（不能连着要删的那个库）。
  const admin = new URL(target.toString());

  admin.pathname = "/postgres";

  const quoted = `"${dbName.replace(/"/g, '""')}"`;

  psql(admin, `DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
  psql(admin, `CREATE DATABASE ${quoted}`);
  console.log(`reset-db: 已重建 ${dbName}`);
}

main();

// 端到端测试的环境约定（前端 #8）：四个进程的端口、后端仓位置、数据库连接串怎么定。
// playwright.config.ts（拉进程）与 e2e/*.spec.ts（调 API / 模拟器管理端点）都从这里取，
// 只在这一处改端口。端口刻意不用默认值（8000 / 8100 / 8200 / 5173），免得撞上正在开发的进程。

import { existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";

/** 后端仓：与本仓并排 checkout（README「端到端」）。 */
export const BACKEND_DIR = path.resolve(
  import.meta.dirname,
  "../../interviewProjects-backend",
);

export const PORTS = {
  web: 15173,
  backend: 18000,
  gateway: 18100,
  agent: 18200,
} as const;

export const WEB_URL = `http://localhost:${PORTS.web}`;

export const BACKEND_URL = `http://localhost:${PORTS.backend}`;

export const GATEWAY_URL = `http://localhost:${PORTS.gateway}`;

export const AGENT_URL = `http://localhost:${PORTS.agent}`;

/** 专用库名：每次跑 e2e 都由 e2e/reset-db.mts 删掉重建，绝不指向开发库。 */
export const E2E_DB_NAME = "interview_e2e";

/**
 * 后端仓的 .env（KEY=VALUE，# 开头是注释，两侧引号去掉）。后端自己不读 .env
 * （src/core/config.ts 只读 process.env，本地靠 node --env-file），所以这里替它读一次，
 * 只取 DATABASE_URL 的用户 / 主机 / 端口与 JWT_SECRET。文件不存在返回空对象。
 */
export function readBackendDotenv(): Record<string, string> {
  const file = path.join(BACKEND_DIR, ".env");

  if (!existsSync(file)) return {};

  const out: Record<string, string> = {};

  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();

    if (line === "" || line.startsWith("#")) continue;

    const eq = line.indexOf("=");

    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");

    out[key] = value;
  }

  return out;
}

/**
 * e2e 用的数据库连接串，优先级：
 * 1. 环境变量 E2E_DATABASE_URL（整串照用，库名必须含 e2e —— reset-db.mts 会拒绝删别的库）；
 * 2. 后端仓 .env 的 DATABASE_URL，只借用户 / 密码 / 主机 / 端口，库名换成 interview_e2e；
 * 3. 都没有：postgres://<当前系统用户>@localhost:5432/interview_e2e。
 */
export function resolveDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;

  if (explicit) return explicit;

  const fromDotenv = readBackendDotenv().DATABASE_URL;

  if (fromDotenv) {
    const url = new URL(fromDotenv);

    url.pathname = `/${E2E_DB_NAME}`;

    return url.toString();
  }

  return `postgres://${userInfo().username}@localhost:5432/${E2E_DB_NAME}`;
}

/** access token 签名密钥：后端 .env 里有就用它，没有就用一个 e2e 专用的固定值（不是秘密）。 */
export function resolveJwtSecret(): string {
  return (
    process.env.E2E_JWT_SECRET ??
    readBackendDotenv().JWT_SECRET ??
    "e2e-only-not-a-secret-0123456789abcdef"
  );
}

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Vite 构建配置。类型检查不在这里：Vite 只用 esbuild 剥类型，`npm run build` 先跑
// `tsc --noEmit`（见 package.json）。vitest 的配置单独放 vitest.config.mts（`test` 段不写在这里）。
export default defineConfig(({ mode }) => {
  // vite.config 本身不经 import.meta.env 注入，.env / .env.local 里的变量要 loadEnv 才读得到
  //（第三个参数 "" = 不按 VITE_ 前缀过滤；VITE_API_PROXY 只给这里用，不进浏览器）。
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const proxyTarget = env.VITE_API_PROXY;

  return {
    // tailwind 4 走 Vite 插件，不需要 postcss.config；globals.css 里 `@import "tailwindcss";` 即可。
    plugins: [react(), tailwindcss()],
    resolve: {
      // `@/` → src，与 tsconfig.json 的 paths、vitest.config.mts 的 alias 三处同口径。
      alias: { "@": "/src" },
    },
    server: {
      // 开发时把 /api 与 /ws 转发到后端，避免跨域：`.env` 里 `VITE_API_PROXY=http://localhost:8000`
      //（见 .env.example）。生产不经过这里 —— 请求层（src/lib/request.ts）按
      // import.meta.env.VITE_API_BASE_URL 拼地址，没设就走同源相对路径；实时连接
      //（src/lib/ws.ts）默认按页面 origin 推出 ws(s)://…/ws。
      proxy: proxyTarget
        ? {
            "/api": { target: proxyTarget, changeOrigin: true },
            "/ws": { target: proxyTarget, changeOrigin: true, ws: true },
          }
        : undefined,
    },
    build: {
      // 产物目录 dist（.gitignore、.prettierignore、eslint globalIgnores 都按这个名字跳过）。
      outDir: "dist",
    },
  };
});

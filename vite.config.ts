import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite 构建配置。类型检查不在这里：Vite 只用 esbuild 剥类型，`npm run build` 先跑
// `tsc --noEmit`（见 package.json）。vitest 的配置单独放 vitest.config.mts（`test` 段不写在
export default defineConfig({
  // tailwind 4 走 Vite 插件，不需要 postcss.config；globals.css 里 `@import "tailwindcss";` 即可。
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` → src，与 tsconfig.json 的 paths、vitest.config.mts 的 alias 三处同口径。
    alias: { "@": "/src" },
  },
  server: {
    // 开发时把 /api 转发到后端，避免跨域：`VITE_API_PROXY=http://localhost:8000 npm run dev`。
    // 生产不经过这里 —— 请求层（src/lib/request.ts）按 import.meta.env.VITE_API_BASE_URL 拼地址，
    // 没设就走同源相对路径。
    proxy: process.env.VITE_API_PROXY
      ? {
          "/api": {
            target: process.env.VITE_API_PROXY,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  build: {
    // 产物目录 dist（.gitignore、.prettierignore、eslint globalIgnores、
    outDir: "dist",
  },
});

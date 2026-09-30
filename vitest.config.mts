import path from "node:path";

import { defineConfig } from "vitest/config";

// 与 vite.config.ts 分开写、不用 mergeConfig 合并：测试不需要 @vitejs/plugin-react / @tailwindcss/vite，
// 合并进来只会拖慢启动。所以 `@` 别名在这里再写一遍（与 vite.config.ts、tsconfig.json 的 paths 三处同口径；
// 想只写一处就换 vite-tsconfig-paths 插件，两份配置都加 `plugins: [tsconfigPaths()]`）。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // 默认 node：绝大多数测试是纯函数。hook 测试在文件头写
    // `// @vitest-environment jsdom` 单独切换。
    environment: "node",
    // Node >= 22 在 globalThis 上预留了 localStorage（不带 --localstorage-file 时
    // 取值 undefined 还带一条 ExperimentalWarning），而 vitest 的 jsdom 环境把
    // window 属性搬到 global 时会跳过「global 上已经有的键」—— jsdom 那份真正的
    // Storage 因此永远露不出来，hook 里 window.localStorage.getItem 直接 TypeError。
    // 关掉 Node 的 webstorage 让 jsdom 的 localStorage 正常暴露。
    execArgv: ["--no-experimental-webstorage"],
    // 覆盖率地板（CI 跑 npm run test:coverage；本地 npm test 不带覆盖率，保持秒级）。
    // *-schema.ts。组件按约定不写渲染测试（浏览器验证兜底），算进来只会把数字
    // 压到十几个点、失去信号。
    // 覆盖率地板只防倒退、只准上调。出厂占位 0：首次 npm run test:coverage 实测后
    // 改成「lines 实测值减 1 取整」。
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**",
        "src/services/**",
        "src/hooks/**",
        "src/**/*-schema.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}"],
      reporter: ["text-summary"],
      thresholds: { lines: 0 },
    },
  },
});

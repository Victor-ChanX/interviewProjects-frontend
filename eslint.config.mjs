import { readdirSync } from "node:fs";

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX, { createNodeResolver } from "eslint-plugin-import-x";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

import { NEUTRAL_PALETTE_SOURCE } from "./scripts/tailwind-colors.mjs";

// 结构地图的告警报告里 —— 报告里多一行不会挡住任何人，规则等于建议。
//
// 结构地图与这里的分工：地图做 lint 表达不了的分析（顺调用链判断某个符号是否
// 真会发请求、被谁引用、环、孤儿）；lint 做"一眼可判"的目录边界。两者互补。
//
// 实际生效配置，校验规则真的开着、没被后面的 override 盖掉。
//
// 下面的 no-restricted-imports 只认 `@/…` 别名；`../` 相对路径能绕过全部分层规则，
// 所以 no-restricted-syntax 里禁了向上的相对路径（S_RELATIVE_PARENT）。
// 没用 import-x/no-relative-parent-imports：它先按 tsconfig 解析别名再判断，`@/lib/x` 也被当成
// 「父目录」，源项目全仓上千处误报。
//
// + components/{ui,ui-atoms}，路由登记在 src/app/router.tsx（React Router 库模式）。
// 结构不同就改 SHARED_UI / REQUEST_BOUNDARY / feature 根目录；
// 「规则实现者」豁免块（src/lib/request.ts、ws.ts、get-error-message.ts、query-keys.ts、ui/sidebar.tsx）
// 按你项目里对应文件的实际路径改；TABLE_PRIMITIVE_ALLOWED 出厂只放行 ui-atoms。

const SHARED_UI = ["@/components/ui/**", "@/components/ui-atoms/**"];
// 实时连接（src/lib/ws.ts）与 HTTP 请求层同属请求边界：view 与路由文件都不许摸。
const REQUEST_BOUNDARY = ["@/lib/api", "@/lib/request", "@/lib/ws"];

/** src/components 下的 feature 目录（ui / ui-atoms 是共享层，不算 feature）。 */
const features = readdirSync("src/components", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== "ui" && name !== "ui-atoms")
  .sort();

/**
 * no-restricted-imports 的选项：`{ group, message }` 进 patterns（按 gitignore 语义匹配模块路径），
 * `{ name, importNames, message }` 进 paths（只禁某个包的某几个具名导出，例如 react-router 的
 * 导航 hook；`Link` / `NavLink` 这类照常可用）。
 */
const restrict = (...groups) => {
  const patterns = groups
    .filter(({ group }) => group)
    .map(({ group, message }) => ({ group, message }));
  const paths = groups
    .filter(({ name }) => name)
    .map(({ name, importNames, message }) => ({ name, importNames, message }));

  return [
    "error",
    {
      ...(patterns.length > 0 ? { patterns } : {}),
      ...(paths.length > 0 ? { paths } : {}),
    },
  ];
};

const VIEW_PATTERN = {
  group: REQUEST_BOUNDARY,
  message:
    "view 不发请求（NEVER: Views do not directly fetch）。把调用移到 container 或 hook；" +
    "从 services 取类型/常量是允许的。",
};

// view 纯展示：不弹 toast、不做路由、不持请求状态（frontend-api-function-calls
// 「useQuery」一节：useQuery 放 hook 不放 view；view NEVER fetch / toast / 路由）。
// 要跳转、提示或数据，由 container 传进来。
const VIEW_EFFECTS_MESSAGE =
  "view 不弹 toast、不做路由、不调 useQuery（view NEVER fetch / toast / 路由）。在 hook / container 里做，" +
  "把结果或回调通过 props 传给 view。";
const VIEW_EFFECTS_PATTERN = {
  group: ["sonner", "@tanstack/react-query"],
  message: VIEW_EFFECTS_MESSAGE,
};
// 路由：react-router 只禁导航 / 路由状态的具名 hook（paths 形式），`Link` / `NavLink` 是展示
// 元素，view 可以用；`useNavigate` 之类放 container，跳转以回调传进 view。
const VIEW_ROUTER_PATH = {
  name: "react-router",
  importNames: [
    "useNavigate",
    "useLocation",
    "useParams",
    "useSearchParams",
    "useLoaderData",
    "useNavigation",
    "redirect",
  ],
  message: VIEW_EFFECTS_MESSAGE,
};

const crossFeaturePattern = (feature) => ({
  group: [
    "@/components/*/**",
    `!@/components/${feature}/**`,
    ...SHARED_UI.map((pattern) => `!${pattern}`),
  ],
  message:
    `feature「${feature}」不能引用其他 feature 的内部文件。` +
    "被 2+ feature 用到的东西要提升到共享位置：UI 进 components/ui-atoms、" +
    "接口封装与其类型进 services、纯函数进 lib。",
});

/**
 * 跨 feature 引用：feature A 不许 import feature B 的内部文件。
 *
 * 每个 feature 生成 override（本目录与共享层放行、其他 feature 一律禁止）——
 * 目录列表在 lint 启动时读取，新增 feature 自动生效，不需要维护清单。
 *
 * 每个 feature 生成两条：flat config 里**同名规则的后一条会整体替换前一条**，
 * 所以 feature 内的 view 必须在这里把「不发请求」和「不跨 feature」两组 pattern
 * 一起给出，否则上面那条通用 view 规则会被这里覆盖掉（写第一版时就踩了，
 * 靠探针文件验证才发现）。
 */
const crossFeatureRules = features.flatMap((feature) => [
  {
    files: [`src/components/${feature}/**`],
    rules: {
      "no-restricted-imports": restrict(crossFeaturePattern(feature)),
    },
  },
  {
    files: [
      `src/components/${feature}/**/*-view.tsx`,
      `src/components/${feature}/**/view.tsx`,
    ],
    rules: {
      "no-restricted-imports": restrict(
        crossFeaturePattern(feature),
        VIEW_PATTERN,
        VIEW_EFFECTS_PATTERN,
        VIEW_ROUTER_PATH,
      ),
    },
  },
]);

// ---------------------------------------------------------------------------
// no-restricted-syntax：规范里「一眼可判」的 NEVER。
//
// 同样受「同名规则后一条整体替换前一条」约束：no-restricted-syntax 在不同目录要
// 生效的选择器集合不同，所以下面把选择器按作用域分组，每个 files 块给出**完整**
// 集合（syntax(...) 拼起来），豁免文件单独一块、用 without(...) 去掉那一条。
// 加一条新选择器时，确认它出现在所有应当生效的块里 —— 登记表的 eslint_sample 会在
// 样例文件的实际生效配置上核对，但只核对样例。
//
// esquery 的正则字面量里不能出现 `/`，匹配路径时用 `^\\.\\.`、`legacy$` 这类写法。
// ---------------------------------------------------------------------------

const bans = (message, ...selectors) =>
  selectors.map((selector) => ({ selector, message }));

// ---- BASE：全部 src，含测试 ----

const S_RELATIVE_PARENT = bans(
  "不要用 ../ 相对路径跨目录引用：分层规则（no-restricted-imports）只认 @/ 别名，相对路径会绕过全部 layer.* 边界。跨目录一律写 @/…，同目录的 ./ 可以。",
  "ImportDeclaration[source.value=/^\\.\\./]",
  "ImportExpression[source.value=/^\\.\\./]",
  "ExportNamedDeclaration[source.value=/^\\.\\./]",
  "ExportAllDeclaration[source.value=/^\\.\\./]",
);
// frontend-api-function-calls「Request Layer」：请求只走 lib/request.ts 一处。
// 取引用（`const f = globalThis.fetch`）、解构、XHR / EventSource / WebSocket / sendBeacon
// 都是同一件事的别名。
const S_FETCH = bans(
  '不要裸 fetch（含取 globalThis.fetch 的引用、XMLHttpRequest / EventSource / WebSocket / navigator.sendBeacon）：base URL、鉴权头、401、错误解析、重试只在 lib/request.ts + lib/api.ts 一处。文件下载用 api.get<Blob>(url, { responseType: "blob" })；预签名直传用 api.request(url, { method: "PUT", auth: false })。',
  "CallExpression[callee.name='fetch']",
  "MemberExpression[property.name='fetch']",
  "VariableDeclarator > ObjectPattern.id > Property[key.name='fetch']",
  "NewExpression[callee.name=/^(XMLHttpRequest|EventSource|WebSocket)$/]",
  "MemberExpression[property.name='sendBeacon']",
);
// frontend-api-function-calls「useQuery」MUST：queryKey 一律从 query-keys 取。
const QUERY_KEY_MESSAGE =
  "不要内联 queryKey 数组字面量。queryKey 一律从 src/lib/query-keys.ts 取（每域一个对象，all 前缀 + 带参函数）；新查询先在那里加 key。";
const S_QUERY_KEY = bans(
  QUERY_KEY_MESSAGE,
  "Property[key.name='queryKey'] > ArrayExpression.value",
  "Property[key.name='queryKey'] > TSAsExpression.value > ArrayExpression.expression",
  "Property[key.name='queryKey'] > TSSatisfiesExpression.value > ArrayExpression.expression",
);
const S_TABLE_FEATURES = bans(
  "不要注册 rowSortingFeature / rowPaginationFeature：后端分页的表本地再排只会和后端结果打架；前端分页的切片已在 use-client-pagination 里做完，不进 table 状态。",
  "Identifier[name=/^row(Sorting|Pagination)Feature$/]",
);
const S_TABLE_LEGACY = bans(
  // getPaginationRowModel 这些 v8 形状的 API），走它 tsc 不会红。
  "不要引 @tanstack/react-table/legacy：那是 v8 形状 API 的兼容入口，本仓按 v9 写（useTable + tableFeatures）。",
  "ImportDeclaration[source.value=/^@tanstack.*legacy$/]",
  "ImportExpression[source.value=/^@tanstack.*legacy$/]",
);
const S_MUTATION_META = bans(
  // frontend-api-function-calls「Error Handling」NEVER：MutationCache 没配，meta 不生效。
  "不要给 mutation 写 meta：MutationCache 没配，meta.errorMessage 不会弹任何东西，失败完全静默。在容器里 await mutateAsync + try/catch + toast.error(getErrorMessage(error, 兜底文案))。",
  "CallExpression[callee.name=/^(useMutation|mutationOptions)$/] > ObjectExpression > Property[key.name='meta']",
);
const S_NEUTRAL = bans(
  "不要写死中性色调色板。用主题 token：bg-background / bg-card / bg-muted / bg-sidebar、text-foreground / text-muted-foreground、border-border。",
  `Literal[value=/${NEUTRAL_PALETTE_SOURCE}/]`,
  `TemplateElement[value.raw=/${NEUTRAL_PALETTE_SOURCE}/]`,
);
// frontend-api-function-calls「今天 / 本月」MUST：按业务时区取。`new Date().toISOString()`
// 是 UTC，东八区 0–8 点会取成前一天（源项目一个表单的「默认今天」就是这么错的）。
const S_UTC_TODAY = bans(
  "不要用 new Date().toISOString() 截「今天」：那是 UTC 日期，东八区早上 8 点前会变成前一天。用 lib 里按业务时区取日期的函数（Intl.DateTimeFormat + timeZone，例如 shanghaiToday()）。",
  "CallExpression[callee.property.name=/^(slice|substring|split)$/][callee.object.callee.property.name='toISOString'][callee.object.callee.object.type='NewExpression'][callee.object.callee.object.callee.name='Date'][callee.object.callee.object.arguments.length=0]",
);
const BASE = [
  ...S_RELATIVE_PARENT,
  ...S_FETCH,
  ...S_QUERY_KEY,
  ...S_TABLE_FEATURES,
  ...S_TABLE_LEGACY,
  ...S_MUTATION_META,
  ...S_NEUTRAL,
  ...S_UTC_TODAY,
];

// ---- STRICT：全部 src，测试除外 ----

// frontend-api-function-calls「Error Handling」NEVER：手写错误断言。`(e: Error) =>`
// 与任何位置的 `instanceof Error` 都是同一种手写，不只是三元。
const ERROR_MESSAGE =
  "不要手写断言取错误文案（`as Error`、`instanceof Error`、把参数注解成 Error）。一律 getErrorMessage(error, 兜底文案)（src/lib/get-error-message.ts）：断网 / 超时翻中文、非 Error 值兜底。";
const S_ERROR_CAST = bans(
  ERROR_MESSAGE,
  "TSAsExpression[typeAnnotation.typeName.name='Error']",
);
const S_ERRORS = [
  ...S_ERROR_CAST,
  ...bans(
    ERROR_MESSAGE,
    "BinaryExpression[operator='instanceof'][right.name='Error']",
    ":function > Identifier.params > TSTypeAnnotation > TSTypeReference[typeName.name='Error']",
  ),
];
// queryKey 的间接写法：先存进 *Key 变量再传、QueryClient 方法的首参数组字面量。
// 测试里造缓存用字面量 key 是合理的（例如登录 hook 的测试清掉上一个账号的缓存），不管。
const QC_METHODS =
  "/^(setQueryData|getQueryData|setQueriesData|getQueriesData|getQueryState|removeQueries|invalidateQueries|refetchQueries|cancelQueries|resetQueries|fetchQuery|prefetchQuery|ensureQueryData|isFetching)$/";
const S_QUERY_KEY_INDIRECT = bans(
  QUERY_KEY_MESSAGE,
  `CallExpression[callee.property.name=${QC_METHODS}] > ArrayExpression.arguments:first-child`,
  `CallExpression[callee.property.name=${QC_METHODS}] > TSAsExpression.arguments:first-child`,
  "VariableDeclarator[id.name=/[kK]ey$/] > ArrayExpression.init",
  "VariableDeclarator[id.name=/[kK]ey$/] > TSAsExpression.init > ArrayExpression.expression",
);
const STRICT = [...S_ERRORS, ...S_QUERY_KEY_INDIRECT];

/** 测试：只禁 `as Error` 与 `instanceof Error ? … :` 三元（mock 里按类型分流是正当的）。 */
const TEST_ERRORS = [
  ...S_ERROR_CAST,
  ...bans(
    ERROR_MESSAGE,
    "ConditionalExpression > BinaryExpression.test[operator='instanceof'][right.name='Error']",
  ),
];

// ---- DATA_LAYER：services / lib，不持 React 请求状态 ----
const QUERY_HOOK_IMPORT =
  "ImportDeclaration[source.value='@tanstack/react-query'] > ImportSpecifier[imported.name=/^use/]";
const DATA_LAYER = bans(
  // frontend-api-function-calls「useQuery」NEVER：service / 纯函数 / wrapper 里用 useQuery。
  "services / lib 不用 useQuery / useMutation 这类 hook：它们放 feature 的 use-*.ts 或 src/hooks。service 只导出返回 Promise 的 wrapper。",
  QUERY_HOOK_IMPORT,
);

// ---- UI_LAYER：components / app ----

// 每个 <form> 都要 noValidate：校验权威只有 zod 一处。浏览器的原生约束校验
// （required / min / max / pattern / type=email / number 的 badInput）在
// checkValidity() 为 false 时**静默吞掉 submit 事件** —— RHF 的 handleSubmit
// 不触发，zod 不跑，errors 不出，用户点保存什么都不发生、也没有任何提示。
// 真实事故：一个详情页的评分输入是 min=0 max=5，而存量数据带着越界的
// 0-10 分，整页无法保存且无提示，tsc/eslint/prettier/vitest 全绿。
const S_FORM_NOVALIDATE = bans(
  "<form> 必须加 noValidate，让 zod 成为唯一校验权威。原生约束校验会静默吞掉 submit：handleSubmit 不触发、错误不显示、点保存毫无反应。min/max 可以留着当输入提示。",
  "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='noValidate']))",
  "JSXOpeningElement[name.name='form'] > JSXAttribute[name.name='noValidate'] > JSXExpressionContainer > Literal[value=false]",
);
const S_UI_TABLE = bans(
  "数据表格一律用 ui-atoms 里的共享 DataTable（列名与列宽写进 columnMeta），不要直接引 ui/table 手写 <Table><TableHeader> 骨架。唯一例外是弹窗里的可编辑行表，清单见 eslint.config.mjs 的 TABLE_PRIMITIVE_ALLOWED。",
  "ImportDeclaration[source.value='@/components/ui/table']",
);
// frontend-overlay-layout：限高 / 滚动写在 Content 上，footer 会跟着滚出视野。
// 高度类（max-h- / h-[…] / h-screen）与滚动类（overflow-auto / -y-auto / -scroll）都算；
// className 直接给变量（cls）时规则看不见里面写了什么，也拦（DIALOG_SHELL 放行）。
const DIALOG_CONTENT =
  "JSXOpeningElement[name.name=/^(Dialog|AlertDialog|Sheet)Content$/] > JSXAttribute[name.name='className']";
const DIALOG_SCROLL =
  "(?<![\\w-])(max-h-|h-\\[|h-(screen|dvh|svh|lvh)\\b|overflow(-y)?-(auto|scroll)\\b)";
const S_DIALOG_SHELL = bans(
  "浮层不要在 DialogContent / SheetContent 上手写 max-h / h-[…] / overflow-auto / overflow-y-auto（footer 会跟着滚出视野），也不要给它传装着类名的变量。用 ui-atoms/dialog-shell.tsx 的 DIALOG_SHELL + DialogBody，只让 body 滚。",
  `${DIALOG_CONTENT} Literal[value=/${DIALOG_SCROLL}/]`,
  `${DIALOG_CONTENT} TemplateElement[value.raw=/${DIALOG_SCROLL}/]`,
  `${DIALOG_CONTENT} > JSXExpressionContainer > Identifier.expression:not([name='DIALOG_SHELL'])`,
  `${DIALOG_CONTENT} CallExpression > Identifier.arguments:not([name='DIALOG_SHELL'])`,
);
// frontend-api-function-calls「Storage Boundary」：storage 只在 hook / service / lib
// 里读写，流程结束时容器可以清键；view、原子、页面 NEVER 直接摸。
// 任何位置出现 localStorage / sessionStorage 标识符都算（含 `const { localStorage: ls } = window`
// 这种解构），外加 document.cookie 与 window["localStorage"] 这类计算属性。
const STORAGE_MESSAGE =
  "组件不直接读写 localStorage / sessionStorage / document.cookie：读取、解析、校验放 feature 的 use-*.ts 或 service（token 走 lib/api），容器只在流程结束时清键。";
const S_STORAGE = bans(
  STORAGE_MESSAGE,
  "Identifier[name=/^(localStorage|sessionStorage)$/]",
  "MemberExpression[computed=true][property.value=/^(localStorage|sessionStorage|cookie)$/]",
);
const S_COOKIE = bans(
  STORAGE_MESSAGE,
  "MemberExpression[property.name='cookie']",
);
// frontend-api-function-calls「useQuery」MUST：请求状态放 hook。组件文件（container、
// view、原子）一律不直接调 react-query 的 hook，只有 use-*.ts 能调。
const S_COMPONENT_QUERY_HOOK = bans(
  "组件文件不调 react-query 的 hook（useQuery / useMutation / useQueryClient …）：请求状态放 feature 的 use-*.ts 或 src/hooks，container 只消费 hook 的输出。",
  QUERY_HOOK_IMPORT,
);
const UI_LAYER = [
  ...S_FORM_NOVALIDATE,
  ...S_UI_TABLE,
  ...S_DIALOG_SHELL,
  ...S_STORAGE,
  ...S_COOKIE,
  ...S_COMPONENT_QUERY_HOOK,
];
/** feature 里允许碰 storage 的文件：hook、单 feature 的 service、容器。 */
const FEATURE_HOOKS = ["src/components/**/use-*.{ts,tsx}"];
const CONTAINERS = ["src/components/**/*-container.tsx"];
const FEATURE_SERVICES = ["src/components/**/*-service.ts"];
const STORAGE_ALL = [...S_STORAGE, ...S_COOKIE];

// ---- PAGE：路由 page.tsx 只挂一个 container ----
const PAGE_MESSAGE =
  "page.tsx 只做路由装配：return <FeatureContainer />（外面最多包一层 <Suspense>），除了 useParams() / useSearchParams() 取路由参数，不调 hook、不持 state、不写别的 JSX。";
const S_PAGE = bans(
  PAGE_MESSAGE,
  "CallExpression[callee.name=/^use[A-Z]/]:not([callee.name=/^use(Params|SearchParams)$/])",
  "CallExpression[callee.property.name=/^use[A-Z]/]",
  "JSXElement:not([openingElement.name.name='Suspense']) JSXElement",
  "JSXFragment",
  "JSXOpeningElement[name.type='JSXIdentifier'][name.name=/^[a-z]/]",
);

/**
 * 可以直接引 ui/table 原语的文件：ui-atoms（DataTable 自己、表内明细行）与弹窗里的
 * 可编辑行表。只准变短。
 * 出厂只放行 ui-atoms（结构性的，DataTable 本身要引原语）；feature 里的可编辑行表
 * 由目标项目逐个文件加进来，接手存量项目时把当天手写 <Table> 的文件填进来再逐步迁。
 */
const TABLE_PRIMITIVE_ALLOWED = ["src/components/ui-atoms/**"];

const syntax = (...groups) => ["error", ...groups.flat()];
const without = (group, ...excluded) =>
  group.filter((entry) => !excluded.flat().includes(entry));

const restrictedSyntaxRules = [
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": syntax(BASE, STRICT) },
  },
  {
    files: ["src/services/**", "src/lib/**"],
    rules: { "no-restricted-syntax": syntax(BASE, STRICT, DATA_LAYER) },
  },
  {
    files: ["src/components/**", "src/app/**"],
    rules: { "no-restricted-syntax": syntax(BASE, STRICT, UI_LAYER) },
  },
  {
    files: ["src/app/**/page.tsx"],
    rules: { "no-restricted-syntax": syntax(BASE, STRICT, UI_LAYER, S_PAGE) },
  },
  // 容器：可以清 storage 键，但不直接调 react-query hook。
  {
    files: CONTAINERS,
    rules: {
      "no-restricted-syntax": syntax(
        BASE,
        STRICT,
        without(UI_LAYER, STORAGE_ALL),
      ),
    },
  },
  {
    files: FEATURE_HOOKS,
    rules: {
      "no-restricted-syntax": syntax(
        BASE,
        STRICT,
        without(UI_LAYER, STORAGE_ALL, S_COMPONENT_QUERY_HOOK),
      ),
    },
  },
  // 单 feature 的 service 与 src/services 同一层：可碰 storage，不许用 query hook。
  {
    files: FEATURE_SERVICES,
    rules: {
      "no-restricted-syntax": syntax(
        BASE,
        STRICT,
        without(UI_LAYER, STORAGE_ALL, S_COMPONENT_QUERY_HOOK),
        DATA_LAYER,
      ),
    },
  },
  {
    files: TABLE_PRIMITIVE_ALLOWED,
    rules: {
      "no-restricted-syntax": syntax(
        BASE,
        STRICT,
        without(UI_LAYER, S_UI_TABLE),
      ),
    },
  },
  {
    files: ["src/components/ui/sidebar.tsx"],
    rules: {
      "no-restricted-syntax": syntax(BASE, STRICT, without(UI_LAYER, S_COOKIE)),
    },
  },
  // 测试只受 BASE 约束（不许真实请求、不许内联 queryKey 属性…），错误断言只禁两种手写。
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "no-restricted-syntax": syntax(BASE, TEST_ERRORS) },
  },
  // 规则的实现者本身。
  {
    files: ["src/lib/request.ts"],
    rules: {
      "no-restricted-syntax": syntax(
        without(BASE, S_FETCH),
        STRICT,
        DATA_LAYER,
      ),
    },
  },
  // 实时连接的实现者：唯一允许 new WebSocket / EventSource 的地方（frontend-realtime-events：
  // 连接只在 src/lib/ws.ts 一处；hook / container 直接 new WebSocket 照样被 S_FETCH 拦）。
  {
    files: ["src/lib/ws.ts"],
    rules: {
      "no-restricted-syntax": syntax(
        without(BASE, S_FETCH),
        STRICT,
        DATA_LAYER,
      ),
    },
  },
  {
    files: ["src/lib/get-error-message.ts"],
    rules: {
      "no-restricted-syntax": syntax(
        BASE,
        without(STRICT, S_ERRORS),
        DATA_LAYER,
      ),
    },
  },
  {
    files: ["src/lib/query-keys.ts"],
    rules: {
      "no-restricted-syntax": syntax(
        without(BASE, S_QUERY_KEY),
        without(STRICT, S_QUERY_KEY_INDIRECT),
        DATA_LAYER,
      ),
    },
  },
];

const eslintConfig = defineConfig([
  // 基础预设（不做 type-checked lint，保持秒级；分层规则不需要类型信息）：
  //   @eslint/js recommended + typescript-eslint recommended
  //   + eslint-plugin-react 的 jsx-runtime（React 17+ 自动 JSX runtime，不要求 import React）
  //   + eslint-plugin-react-hooks 的 flat["recommended-latest"]（含 React Compiler 系列规则，
  //     react-hooks/set-state-in-effect 在里面；7.x 起 configs.recommended / recommended-latest
  //     是 eslintrc 形状，flat config 要取 configs.flat 下的）
  //   + eslint-plugin-react-refresh（Vite HMR：一个文件只导出组件）
  //   + eslint-plugin-import-x（只开 order / no-duplicates / no-extraneous-dependencies 三条，
  //     不上 flatConfigs.recommended：它带的 no-named-as-default(-member) 对 `import ts from
  //     "typescript"` 这类正当写法一片 warn，no-unresolved 由 tsc 兜着；`@/` 别名交给 typescript resolver）
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  // flatConfigs.typescript 只注册插件 + TS 扩展名 / parser 的 settings（rules 里只有 named: off）。
  importX.flatConfigs.typescript,
  {
    settings: {
      react: { version: "detect" },
      // import-x 4.6+ 的 resolver-next：typescript resolver 读 tsconfig.json 的 paths 解析 `@/`，
      // 让 no-extraneous-dependencies 把 `@/lib/x` 当仓内文件而不是 `@/` 作用域的外部包；
      // node resolver 兜底解析裸包名（.mjs 脚本里的 import 不经 tsconfig）。
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        }),
        createNodeResolver(),
      ],
    },
  },
  // 浏览器代码（src）与 Node 脚本（scripts / 根配置）的全局变量：typescript-eslint 已对 .ts 关掉
  // no-undef，这里主要给 .mjs 脚本用（process / console）。
  {
    files: ["src/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
  },
  {
    files: ["scripts/**", "*.{js,mjs,ts,mts}"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
  },
  // 端到端（e2e/**，前端 #8）与 playwright.config.ts：跑在 Node 里（Playwright 的 request /
  // page 是它自己的 API，不经 src/lib/request.ts），所以给 node 全局变量。上面的分层
  // no-restricted-imports 与 no-restricted-syntax（裸 fetch、queryKey、../ 相对路径……）都只匹配
  // src/**，对 e2e 本来就不生效 —— 这里不再加限制，也不把 src 的规则复制过来：e2e 里
  // 直接调 API 与模拟器管理端点是它的本职。仍受全局规则（import 顺序 / 空行 / 未用变量 /
  // 只能 import package.json 里声明的包）约束。
  {
    files: ["e2e/**", "playwright.config.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
  },
  // Vite 的 React Fast Refresh 要求一个模块只导出组件，否则整页刷新。路由文件按
  // React Router lazy 约定具名导出：`Component` / `ErrorBoundary` / `HydrateFallback` 是
  // PascalCase 的组件，规则本来就认；`loader` / `action` / `handle` / `shouldRevalidate` 不是
  // 组件，用 allowExportNames 放行。**不要把 Component 写进 allowExportNames**：列在里面的
  // 名字会被整个跳过、不计为「导出了组件」，page.tsx 里再多导出个 helper 也不会红
  // （用探针文件验证过）。
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: ["loader", "action", "handle", "shouldRevalidate"],
        },
      ],
    },
  },
  // react-hooks/set-state-in-effect 按 flat["recommended-latest"] 开着（error），别关。
  // 源项目曾经把它设成 "off"：存量一串 useEffect 里拉数据再 setState，开着就是一片红；
  // 全部迁成 useQuery 之后才打开，剩下的「在 effect 里 setState」都是同步派生 / 重置本地
  // state 的合法用法，逐行 `eslint-disable-next-line react-hooks/set-state-in-effect` 并写明
  // 理由。新增的 useEffect 拉数据会直接被这条拦下 —— 用 useQuery。
  // 接手存量项目开不了：先按文件临时关，迁完再开，别整仓关。

  {
    rules: {
      // 预设里是 warn / 未开的几条升为 error：warn 不让 npm run lint 失败，等于没拦。
      "react-hooks/set-state-in-effect": "error",
      // frontend-code-formatting「TypeScript Hygiene」MUST：删掉未用的 import。
      // typescript-eslint recommended 默认是 error，这里钉死，免得换预设时悄悄变 warn。
      "@typescript-eslint/no-unused-vars": "error",
      // frontend-code-formatting「Import Order」NEVER：同一模块路径重复 import。
      "import-x/no-duplicates": "error",
      // target="_blank" 必须带 rel="noreferrer"（jsx-runtime 预设不带 recommended 的规则）。
      "react/jsx-no-target-blank": "error",
      // （nanoid、immer 这类被别的包带进 node_modules 的）可以直接 import，
      // DEPENDENCY_BASELINE 只看 package.json，看不见它们。
      "import-x/no-extraneous-dependencies": [
        "error",
        { devDependencies: true },
      ],
    },
  },

  // frontend-code-formatting「Import Order」「Padding Lines」：与 taro-miniprogram pack 的
  // eslintrc 同口径（存量由一次 eslint --fix 改齐，那个提交记进 .git-blame-ignore-revs）。
  // shadcn 原语按上游整份保留、生成物不归我们排版，不管。
  {
    files: ["**/*.{js,mjs,ts,mts,tsx}"],
    ignores: ["src/components/ui/**", "src/types/api.generated.ts"],
    rules: {
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
          ],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["block-like"], next: "*" },
        { blankLine: "always", prev: ["function", "export"], next: "*" },
      ],
    },
  },

  // 路由层：layout 只做路由级装配，挂 container 与全局 Provider（ui 原语如 Toaster
  // 放行），不碰数据层、不伸手进 feature 内部（container 与 feature 的 types 除外）。
  {
    files: ["src/app/**/layout.tsx"],
    rules: {
      "no-restricted-imports": restrict(
        {
          group: [
            "@/components/*/**",
            "!@/components/*/*-container",
            "!@/components/*/types",
            ...SHARED_UI.map((pattern) => `!${pattern}`),
          ],
          message:
            "路由文件只能挂 feature 的 container（page files import feature containers, " +
            "not internal feature atoms or hooks）。需要状态/JSX 就放进 container 或 view。",
        },
        {
          group: ["@/services/**", ...REQUEST_BOUNDARY],
          message:
            "路由文件不做数据获取。请求放进 feature 的 hook（TanStack Query），由 container 组织。",
        },
      ),
    },
  },

  // page.tsx 比 layout 更窄：只 import feature 的 container 与 types，别的 @/ 一律不行
  // （没有 ui / ui-atoms 豁免，hooks、lib、services 都禁）。JSX 形状由上面 S_PAGE 管。
  {
    files: ["src/app/**/page.tsx"],
    rules: {
      "no-restricted-imports": restrict({
        // 不能写成 "@/**" 再用 ! 放行：no-restricted-imports 按 gitignore 语义匹配，
        // 父目录（@/components）被排除后子路径无法再放行，全部页面一起红。
        group: [
          "@/components/*/**",
          "!@/components/*/*-container",
          "!@/components/*/types",
          "@/hooks/**",
          "@/lib/**",
          "@/services/**",
          "@/types/**",
        ],
        message:
          "路由文件只能挂 feature 的 container（page.tsx 只 import feature 的 *-container 与 types）。" +
          "UI、hook、lib、service 都放进 container 或 view。",
      }),
    },
  },

  // 应用装配层：router.tsx 是唯一的路由登记处（createBrowserRouter + lazy: () => import("./x/page")），
  // providers.tsx 挂 QueryClientProvider / NuqsAdapter / ThemeProvider / Toaster。两者只许引
  // src/app 内部（相对 ./ 或 @/app/**）、ui 原语、ui-atoms 与 QueryClient 的构造模块
  // —— 不引 feature、不引 services、不摸请求边界。
  // `@/lib/query-client` 是占位名：把它改成你项目里 new QueryClient() 所在的模块路径
  // （没有单独模块、直接写在 providers.tsx 里的，删掉这一条放行即可）。
  {
    files: ["src/app/router.tsx", "src/app/providers.tsx"],
    rules: {
      "no-restricted-imports": restrict({
        group: [
          "@/components/*/**",
          ...SHARED_UI.map((pattern) => `!${pattern}`),
          "@/hooks/**",
          "@/services/**",
          "@/lib/**",
          "!@/lib/query-client",
          "@/types/**",
        ],
        message:
          "router.tsx / providers.tsx 只做应用装配：路由登记只 lazy import src/app 下的 page / layout，" +
          "Provider 只挂 ui 原语与 QueryClient；feature、services、请求层都不在这里出现。",
      }),
    },
  },

  // view 层：纯展示，props 进、回调出。不许直接摸请求客户端、toast、路由。
  // （feature 目录内的 view 由 crossFeatureRules 里的 view 变体覆盖，见那里的注释。）
  {
    files: ["src/components/**/*-view.tsx", "src/components/**/view.tsx"],
    rules: {
      "no-restricted-imports": restrict(
        VIEW_PATTERN,
        VIEW_EFFECTS_PATTERN,
        VIEW_ROUTER_PATH,
      ),
    },
  },

  // 数据层与工具层不能反向依赖 UI —— 与后端 import-linter 的方向约束同构。
  {
    files: ["src/services/**", "src/lib/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": restrict({
        group: ["@/components/**"],
        message:
          "services / lib / hooks 是被依赖方，不能反向依赖组件。" +
          "需要共享的类型放进 services 或 lib 自身。",
      }),
    },
  },

  // shadcn 原语保持纯净：只依赖 lib/utils（cn）与其他原语，不碰业务。
  // 的 ui/ 豁免），上游 sidebar.tsx 的 useIsMobile 就在 effect 里同步 setState。
  // only-export-components 同理：上游 button.tsx 把 buttonVariants（cva）和 Button 一起导出，
  // 改它就偏离上游；这一层的 HMR 退化成整页刷新可以接受。
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
      "no-restricted-imports": restrict({
        group: [
          "@/components/*/**",
          "!@/components/ui/**",
          "@/services/**",
          "@/hooks/**",
          "@/lib/**",
          "!@/lib/utils",
        ],
        message:
          "components/ui 是 shadcn 原语，不依赖业务代码（lib 里只放行 cn 所在的 @/lib/utils）。带业务语义的共享组件放 components/ui-atoms。",
      }),
    },
  },

  // 写死颜色：中性色由上面 S_NEUTRAL 直接拦（全部 src）。语义状态色（green/red/amber
  // 表示通过/拒绝/待审）还有存量，ESLint 没有「按文件冻结计数」的能力，由
  ...restrictedSyntaxRules,

  ...crossFeatureRules,

  // 测试文件按同位约定引用被测模块，且需要跨 feature 造数，豁免上述导入边界
  // （no-restricted-syntax 不豁免：测试里同样不许真实 fetch、不许 ../ 相对路径）。
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "no-restricted-imports": "off" },
  },

  // 构建产物、覆盖率、生成物与 agent 配置不 lint（node_modules 是 eslint 默认忽略）。
  // src/types/api.generated.ts 是 openapi-typescript 的输出：整个跳过，与 .prettierignore 同口径。
  globalIgnores([
    "dist/**",
    "coverage/**",
    "src/types/api.generated.ts",
  ]),
]);

export default eslintConfig;

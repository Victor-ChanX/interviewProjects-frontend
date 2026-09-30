// 控制台的菜单与面包屑（前端 #12）：左侧菜单只放叶子路由，按「概览 / 运营 / 监控 / 系统」分组；
// 面包屑按路由生成（「运营 / 群组管理 / 群详情」）。页面名称与后端仓 docs/manual-testing.md 一致。
// 图标由视图按 key 取（lib 不碰组件）；路由本身登记在 src/app/router.tsx，这里只描述「怎么叫、放哪组」。

export type NavKey =
  | "dashboard"
  | "accounts"
  | "groups"
  | "sequences"
  | "agentRuns"
  | "activity"
  | "inconsistencies"
  | "llmSettings";

export interface NavItem {
  key: NavKey;
  label: string;
  path: string;
}

export interface NavSection {
  title: string;
  items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "概览",
    items: [{ key: "dashboard", label: "工作台", path: "/dashboard" }],
  },
  {
    title: "运营",
    items: [
      { key: "accounts", label: "账号管理", path: "/accounts" },
      { key: "groups", label: "群组管理", path: "/groups" },
      { key: "sequences", label: "定时序列", path: "/sequences" },
      { key: "agentRuns", label: "Agent 运行", path: "/agent-runs" },
    ],
  },
  {
    title: "监控",
    items: [
      { key: "activity", label: "实时动态", path: "/activity" },
      { key: "inconsistencies", label: "异常中心", path: "/inconsistencies" },
    ],
  },
  {
    title: "系统",
    items: [{ key: "llmSettings", label: "模型设置", path: "/settings/llm" }],
  },
];

export interface Crumb {
  label: string;
  /** 可点的层级；分组名与当前页没有 href。 */
  href?: string;
}

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** 当前路由属于哪个菜单项（详情页归到它的列表项）；不属于任何一项为 null。 */
export function findNavItem(
  pathname: string,
): { section: NavSection; item: NavItem } | null {
  for (const section of NAV_SECTIONS)
    for (const item of section.items)
      if (isUnder(pathname, item.path)) return { section, item };

  return null;
}

/** 详情页在菜单项之后多出来的层级（按路径段数判断，id 本身不显示）。 */
function detailCrumbs(item: NavItem, pathname: string): Crumb[] {
  const rest = pathname
    .slice(item.path.length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  if (rest.length === 0) return [];

  if (item.key === "groups") {
    const detailHref = `${item.path}/${encodeURIComponent(rest[0])}`;

    if (rest.length >= 2 && rest[1] === "sequences")
      return [{ label: "群详情", href: detailHref }, { label: "序列运行" }];

    return [{ label: "群详情" }];
  }

  if (item.key === "agentRuns") return [{ label: "运行详情" }];

  return [{ label: "详情" }];
}

/** 面包屑：分组 / 菜单项 / 详情层级。最后一级是当前页，不可点。 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const found = findNavItem(pathname);

  if (!found) return [{ label: "页面不存在" }];

  const { section, item } = found;
  const details = detailCrumbs(item, pathname);

  return [
    { label: section.title },
    details.length > 0
      ? { label: item.label, href: item.path }
      : { label: item.label },
    ...details,
  ];
}

export const PRODUCT_NAME = "群组消息平台";

/** 浏览器标签页标题：当前页名 · 产品名。 */
export function documentTitle(pathname: string): string {
  const crumbs = buildBreadcrumbs(pathname);
  const current = crumbs[crumbs.length - 1]?.label;

  return current ? `${current} · ${PRODUCT_NAME}` : PRODUCT_NAME;
}

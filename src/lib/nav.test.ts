import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbs,
  documentTitle,
  findNavItem,
  NAV_SECTIONS,
} from "@/lib/nav";

describe("NAV_SECTIONS", () => {
  it("groups the leaf routes with the manual-testing page names", () => {
    expect(
      NAV_SECTIONS.map((section) => [
        section.title,
        section.items.map((item) => `${item.label} ${item.path}`),
      ]),
    ).toEqual([
      ["概览", ["工作台 /dashboard"]],
      [
        "运营",
        [
          "账号管理 /accounts",
          "群组管理 /groups",
          "定时序列 /sequences",
          "Agent 运行 /agent-runs",
        ],
      ],
      ["监控", ["实时动态 /activity", "异常中心 /inconsistencies"]],
      ["系统", ["模型设置 /settings/llm"]],
    ]);
  });
});

describe("findNavItem", () => {
  it("matches the list route and its detail routes on segment boundaries", () => {
    expect(findNavItem("/groups")?.item.key).toBe("groups");
    expect(findNavItem("/groups/g1/sequences")?.item.key).toBe("groups");
    expect(findNavItem("/agent-runs/r1")?.item.key).toBe("agentRuns");
    expect(findNavItem("/settings/llm")?.item.key).toBe("llmSettings");
    expect(findNavItem("/groupsx")).toBeNull();
    expect(findNavItem("/")).toBeNull();
  });
});

describe("buildBreadcrumbs", () => {
  it("builds section / page for list routes", () => {
    expect(buildBreadcrumbs("/dashboard")).toEqual([
      { label: "概览" },
      { label: "工作台" },
    ]);
    expect(buildBreadcrumbs("/inconsistencies")).toEqual([
      { label: "监控" },
      { label: "异常中心" },
    ]);
  });

  it("links back to the list from a group detail and its sequence page", () => {
    expect(buildBreadcrumbs("/groups/g%201")).toEqual([
      { label: "运营" },
      { label: "群组管理", href: "/groups" },
      { label: "群详情" },
    ]);
    expect(buildBreadcrumbs("/groups/g%201/sequences")).toEqual([
      { label: "运营" },
      { label: "群组管理", href: "/groups" },
      { label: "群详情", href: "/groups/g%201" },
      { label: "序列运行" },
    ]);
  });

  it("names the agent run detail page", () => {
    expect(buildBreadcrumbs("/agent-runs/r1")).toEqual([
      { label: "运营" },
      { label: "Agent 运行", href: "/agent-runs" },
      { label: "运行详情" },
    ]);
  });

  it("falls back for unknown routes", () => {
    expect(buildBreadcrumbs("/nope")).toEqual([{ label: "页面不存在" }]);
  });
});

describe("documentTitle", () => {
  it("is the current page name plus the product name", () => {
    expect(documentTitle("/groups/g1")).toBe("群详情 · 群组消息平台");
    expect(documentTitle("/accounts")).toBe("账号管理 · 群组消息平台");
  });
});

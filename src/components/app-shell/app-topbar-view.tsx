// view：工作台顶栏 —— 折叠按钮、面包屑（按路由生成）、右侧实时连接徽标（实时 / 重连中 / 同步中 / 离线）。

import { Fragment } from "react";
import { Link } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StatusBadge } from "@/components/ui-atoms/status-badge";

import type { AppTopbarViewProps } from "./types";

export function AppTopbarView({ breadcrumbs, connection }: AppTopbarViewProps) {
  const last = breadcrumbs.length - 1;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur supports-backdrop-filter:bg-card/75 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-center"
      />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {breadcrumbs.map((crumb, index) => (
            <Fragment key={`${index}:${crumb.label}`}>
              {index > 0 ? (
                <BreadcrumbSeparator className="hidden sm:block" />
              ) : null}
              <BreadcrumbItem
                className={index < last ? "hidden sm:inline-flex" : "min-w-0"}
              >
                {index === last ? (
                  <BreadcrumbPage className="truncate font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink render={<Link to={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {connection ? (
        <StatusBadge
          tone={connection.tone}
          pulse={connection.pending}
          data-testid="connection-status"
          title="实时连接状态"
        >
          {connection.label}
        </StatusBadge>
      ) : null}
    </header>
  );
}

# Design

## Context

`@backstage/plugin-app`'s `PageLayout` reads `useBreadcrumbEntries()` and passes the entries as the `breadcrumbs` prop of the Backstage UI `PluginHeader`; pages register entries with `BreadcrumbEntry` from `@backstage/frontend-plugin-api`.

## Goals / Non-Goals

**Goals:** platform breadcrumbs "Boards / <board name>" in the plugin header. **Non-Goals:** breadcrumbs elsewhere.

## Decisions

- `BoardPage` wraps its content in nested `BreadcrumbEntry` components: outer `{ href: <root path>, label: 'Boards' }` (root path from `useRouteRef(rootRouteRef)`), inner `{ href: <root>/<boardId>, label: board.name }`. The "← Boards" button is dropped.

## Risks / Trade-offs

- [None] → uses the supported registration API; entries unmount with the page.

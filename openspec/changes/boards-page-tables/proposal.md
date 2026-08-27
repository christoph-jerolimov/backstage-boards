# Boards Page Lists as Tables

## Why

The Boards page renders boards and my-items as hand-built bordered
rows while every other listing in the plugin (board table view, recent
changes) is a Backstage UI table, and neither list offers the row
actions menu the board table already has. The header also carries a "My
items" button that duplicates the "My items" tab right below it.

## What Changes

- The "My items" button is removed from the Boards page header; the tab
  remains the way in (the standalone `/my-items` page keeps working).
- The Favorites and All lists become a BUI table: favorite star, name,
  entities, access, and a trailing Actions column.
- The My items list becomes one BUI table per board group: item, status,
  due date, tags, and the same trailing Actions column.
- Every row's Actions cell holds a three-dot menu button, and
  right-clicking a row opens that same menu at the pointer — the
  gesture the board's table and cards already support.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: the board list view is specified as a table
  with a per-row actions menu reachable by button and by right-click.
- `boards/item-management`: the my-items view is specified as tables
  with the same per-row actions menu, and the board list page no longer
  needs a button link to it.

## Impact

- `plugins/boards`: `BoardListPage` (header button, board tables, board
  row menu), `MyItemsPage` (`MyItemsList` tables), a shared row-menu
  helper extracted from `ItemMenu`'s context-menu anchor.

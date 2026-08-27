# Column Colors

## Why

Columns (statuses) are visually identical, so scanning a board or table for status is slower than it needs to be. A per-column color makes status recognizable at a glance everywhere it appears.

## What Changes

- Columns get an optional color, picked from a fixed palette in the column menu (write access).
- The color is shown as a small dot in the kanban column header, as the status badge color in the table view, and as the status badge next to the status select in the item drawer.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: columns carry an optional display color configurable from the UI.

## Impact

- `plugins/boards-backend`: migration (`board_columns.color`), column create/update accept color, tests.
- `plugins/boards-common`: `BoardColumn.color`, palette constant.
- `plugins/boards`: color submenu in the column menu, dot in header, `StatusBadge` component used by table and drawer.

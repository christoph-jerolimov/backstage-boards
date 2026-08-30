## Why

Kanban's core discipline — limiting work in progress — has no support:
columns only show a count. Teams want a visible nudge when a column gets
crowded and a hard stop when it is full, enforced server-side so no
client can bypass it.

## What Changes

- Columns gain two optional limits: a **soft WIP limit** and a **hard
  WIP limit** (positive integers, soft ≤ hard when both set), editable
  from the column menu via a small "WIP limits" dialog.
- The kanban column header shows the count against the limit (e.g.
  `Doing (5/4)`) and takes a warning background once the item count
  reaches the soft limit, and an error background once it reaches the
  hard limit.
- The backend rejects creating an item in — or moving an item into — a
  column whose item count has reached its hard limit (409 conflict);
  reordering within the column stays allowed.
- The UI disables the ways into a full column: the add-item row of the
  column, the item menu's and pickers' move/status entries for that
  column, keyboard moves, and card drops.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/board-management`: a new "Column WIP limits" requirement
  covers limit configuration, the header indicator, and hard-limit
  enforcement.

## Impact

- `plugins/boards-common` — `BoardColumn` gains `wipSoftLimit` /
  `wipHardLimit` and a shared `wipState` helper.
- `plugins/boards-backend` — migration adding the two columns,
  validation in add/updateColumn, enforcement in createItem/moveItem.
- `plugins/boards` — column header state, WIP limits dialog, disabled
  move/create affordances.
- Docs: column configuration sections in README and `docs/features`.

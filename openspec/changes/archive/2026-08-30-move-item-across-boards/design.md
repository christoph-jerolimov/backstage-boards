## Context

Items and their satellites live in per-item tables keyed by `item_id`
(`item_tags`, `item_assignees`, `item_checklist_entries`,
`item_description_versions`, `comments` + versions, `changes`), all
board-scoped only through the item row (`items.board_id`) — except
`changes`, which also carries `board_id` per row. `listBoards` can
filter by write access on the frontend via each entry's `access`.
`requireWipCapacity` guards column entry; `deleteItem` archives.

## Goals / Non-Goals

**Goals:**
- Atomic move preserving the full record of the item's life.
- The two-step dialog exactly as pitched (board, then column).

**Non-Goals:**
- No bulk move; no cross-instance move; no keeping watches (watchers
  are people of the source board's context).

## Decisions

- **New item id**: the move creates a new item row (new id) on the
  target board and re-points the satellite rows' `item_id` to it
  inside one transaction — description versions, tags, assignees,
  checklist, comments and comment versions travel by id re-pointing
  (cheap and lossless); `changes` rows are re-pointed and their
  `board_id` updated. The original row keeps its id and is archived
  with a "moved away" tombstone title? No — the original is archived
  as-is BUT its satellites moved. To keep the archived original
  restorable and meaningful, the satellites are *copied* for the moved
  item instead of re-pointed, except `changes`/`comments`, which
  follow the item to the target (the history lives with the live
  item); the archived original keeps its fields (tags, assignees,
  checklist, description text) but its activity timeline moves.
- **Priority mapping by name**, case-sensitive, like the actions
  surface references priorities.
- **Move record**: one `moved` change with field `board`, old value =
  source board name, new value = target board name.
- **Dialog**: reuses the board-list query filtered to
  `levelIncludes(access, 'write')` entries with a `SearchField`, then
  a `Select` for columns from `getBoard` of the target.
- **Route** `POST /boards/:boardId/items/:itemId/move-to-board` with
  `{ targetBoardId, targetColumnId }`, returning the new item id and
  requiring write on both boards; external items rejected.

## Risks / Trade-offs

- The archived original loses its activity trail (it moved with the
  item); acceptable — the tombstone still names who archived it, and
  restoring it yields a usable item.
- Signals fire for both boards so open views refresh.

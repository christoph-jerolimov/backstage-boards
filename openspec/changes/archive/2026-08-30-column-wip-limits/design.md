## Context

Columns live in `board_columns` (id, board_id, title, position, color)
with add/update paths through `BoardsService.addColumn/updateColumn`,
`PATCH /boards/:boardId/columns/:columnId`, and the frontend
`BoardsApi.updateColumn`. The kanban lane (`BoardView`) renders the
header with `{column.title} ({items.length})` — where `items` are the
*filtered* items — and offers a per-column menu (insert, move, color,
delete). Item entry points into a column: `createItem`, `moveItem`
(service + optimistic frontend), the item menu / flat pickers
(`ItemMenu`), the status selects (`ItemBadgeSelects`), keyboard
shortcuts (Ctrl+arrows), drag & drop, and the bulk status action.

## Goals / Non-Goals

**Goals:**
- Two optional per-column limits stored server-side and enforced there.
- Warning/error header background driven by unfiltered counts.
- Frontend affordances into a hard-full column disabled where the data
  is at hand.

**Non-Goals:**
- No enforcement of the soft limit anywhere — it is purely visual.
- No disabling inside the bulk-actions bar or the my-items page menus
  (they lack per-board counts); the backend rejection surfaces as the
  usual error banner there.
- No historical WIP reporting.

## Decisions

- **Schema**: nullable integers `wip_soft_limit` / `wip_hard_limit` on
  `board_columns`; `BoardColumn.wipSoftLimit?/wipHardLimit?`.
  Validation in the service: integers ≥ 1, soft ≤ hard when both set
  (`InputError` otherwise). Setting `null` clears a limit.
- **Shared helper** `wipState(column, count): 'ok' | 'soft' | 'hard'`
  in `plugins/boards-common`, used by the header and by the backend's
  error paths' tests. Hard wins over soft; both trigger at `count >=
  limit`.
- **Enforcement point**: `createItem` and `moveItem` (only when the
  target column differs from the current one) count non-archived items
  in the target column inside the existing flow and throw
  `ConflictError` at `count >= hardLimit`. Bulk moves fan out per item,
  so partial success + error banner matches existing bulk semantics.
- **Header**: the lane header row gets a wrapping div with padding and
  border-radius whose background is `--bui-bg-warning`/`--bui-bg-danger`
  in the soft/hard state; the count renders as `n/limit` (hard limit
  preferred) when any limit is set. Counts come from a new
  `columnCounts` computed in `BoardPage` over the *unfiltered* items and
  passed to both views.
- **Disabling**: `BoardPage` derives `fullColumnIds: Set<string>` and
  passes it down; `ItemMenu`, the flat pickers, `ItemBadgeSelects`, the
  `AddItemRow`, keyboard moves, and the lane drop handler treat a target
  in that set as disabled (menu entries via `isDisabled`, drop by
  ignoring the drop). An item already in the column is unaffected.

## Risks / Trade-offs

- Enforcement counts and inserts are not serialized against concurrent
  writers, so a race can overshoot a hard limit by one; acceptable for
  a collaboration nudge, and the header still shows the true count.
- Disabled affordances depend on client-side counts that may lag behind
  live updates; the backend check is authoritative.

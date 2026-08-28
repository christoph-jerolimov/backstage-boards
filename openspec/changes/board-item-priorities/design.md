# Design

## Context

See proposal.md — Why. The relevant existing shapes:

- `board_columns` is the closest precedent: a per-board ordered child
  table with a `double` position, a nullable palette `color`, CRUD on
  `BoardsService`, and a delete flow that forces the caller to name a
  target column for the orphaned items.
- Items already carry a nullable single-valued field with history and a
  quick menu — `due_date` — so priority can follow that path end to end
  (`ItemUpdate.dueDate` → `updateItem` change record → `ItemMenu`
  submenu → drawer control).
- `BoardWithContext` already ships `columns` with the board, so the
  board page has the board's configuration before it renders items.
  `MyBoardItem`, by contrast, is a flat listing with a pre-resolved
  `columnTitle` because its consumers (the home page card, the my-items
  tables) do not necessarily have the board loaded.
- Grouping is a pure function `groupItems(items, mode)` over a
  `GroupByMode` union, with `GroupLabel` rendering a group key.
- The item filter is a shared `ItemFilter` applied both client-side
  (`itemMatchesFilter`) and in SQL (`BoardsService.listItems`).

## Goals / Non-Goals

**Goals:**

- One source of truth for a board's priorities, delivered with the board
  so every board surface can render and offer them without extra fetches.
- Order numbers that are always contiguous 1..N, by construction rather
  than by convention.
- Zero visible change on a board that has no priorities.

**Non-Goals:**

- No global or organization-wide priority catalog; priorities are
  per-board, like columns.
- No automatic behavior driven by priority (no sorting default, no
  notification rules, no SLA).
- No backfill of priorities onto existing boards.
- No multi-priority items and no priority on comments.

## Decisions

### Store the order number, renumber on every mutation

`board_priorities` stores an integer `order` and every mutation that can
change the list (create, delete, reorder) rewrites the whole board's
order column inside the same transaction. Alternative considered: a
`double` position like `board_columns`, deriving the 1..N number on read.
Rejected because the requirement states the order number is a real
1..10 field that items and the matrix are ordered by, and a derived
number would have to be recomputed identically in the backend, the
client, and the API contract. With a hard cap of 10 rows per board, a
full renumber is cheaper than the fractional-position bookkeeping it
replaces, and it makes "contiguous from 1" an invariant of the table
rather than something the UI hopes for.

The reorder endpoint takes the complete ordered id list
(`PUT /boards/:boardId/priorities/order` with `{ ids: [...] }`) and
rejects a list that is not exactly the board's current set. Alternative
considered: a per-priority `order` patch. Rejected because two clients
patching different priorities can leave the list with duplicates, and
because "move up" in the settings dialog is naturally expressed as the
new full order.

### Items reference priorities by id, nothing else

`items.priority_id` is a nullable plain column holding a
`board_priorities.id`. Rename and recolor are therefore free. It carries
no database-level foreign key: the repo's existing migrations only ever
`alterTable` plain columns, and adding a constrained column to `items`
would force a table rebuild on SQLite for no gain — nothing relies on
database-side referential behavior here. `deletePriority` runs the
reassign-or-drop decision explicitly in a transaction (`SET priority_id
= <target|NULL>`, delete the row, renumber), mirroring `deleteColumn`'s
`moveItemsTo`, and the board cascade removes the items themselves
alongside the priorities.

`updateItem` validates that the named priority belongs to the item's
board before accepting it, the same guard style `moveItem` uses for
columns.

### History records priority names, not ids

The change record for `field: 'priority'` stores the old and new
priority *names* (or `undefined` for none), the way `moved` already
stores column titles. An id in the history would render as a UUID once
the priority is renamed or removed, which is exactly the case history is
supposed to explain. `changeSummary` needs no change: its generic
`changed priority: "high" → "critical"` branch already covers it.

### Reuse the column color palette

`COLUMN_COLORS` becomes the shared board palette and priorities take
their color from the same eight names, exported additionally as
`PriorityColor = ColumnColor`. Alternative considered: a separate
priority palette with its own hexes. Rejected — two palettes drifting
apart on one board is a worse outcome than a slightly historical type
name, and red/orange (the required defaults for critical/high) are
already in the set. `COLUMN_COLORS` is not renamed, so nothing existing
has to change.

### Priorities ride along with the board, resolved for my-items

`BoardWithContext.priorities` carries the ordered list, so the board
page, the settings dialog, the filter, the grouping, the menus, and the
matrix all read one already-cached value. `MyBoardItem` instead gains a
fully resolved `priority?: BoardPriority`, matching how it already
pre-resolves `columnTitle`: the home page card renders before any board
query exists, and the my-items tables must not fan out one board fetch
per group just to name a badge.

### Grouping and filtering stay pure functions

`GroupByMode` gains `'priority'` and `groupItems` gains an options
argument carrying the board's priorities, used only to order the groups
(order number ascending, `NO_PRIORITY` sentinel last). `GroupLabel`
takes the same list to turn a group key into a name and color. Group
counts are rendered from `group.items.length` at the call site, so the
board and table views show the same numbers without a second pass.

`ItemFilter` gains `priorityIds?: string[]`, with OR semantics inside
the array and AND against `text` and `tags`. This differs from `tags`
(AND inside the array) on purpose: an item has at most one priority, so
AND across two priorities would always return nothing. A `'none'`
sentinel in the array selects items without a priority. `listItems`
translates the array to a single `whereIn` (plus `whereNull` when the
sentinel is present) so the SQL and client-side paths agree.

### The matrix is a client-side pivot

`PriorityMatrixDialog` pivots the already-loaded, unfiltered item list
(`useItemsQuery`, which the board page filters client-side) over
`board.columns` × `board.priorities`. Alternative considered: a
`GET /boards/:id/matrix` aggregation endpoint. Rejected as premature —
a board's item list is already in the cache, boards are bounded by the
same practical size that makes a kanban usable, and a server endpoint
would add a second definition of "non-archived item" to keep in sync.
The matrix intentionally ignores the active filter bar: it is a report
about the board, and a filtered matrix would silently contradict the
totals a user came to read.

### Where each affordance is gated

| Surface | Shown when |
| --- | --- |
| Settings priority editor | `admin` access |
| Item priority controls (menu, drawer) | board has priorities, write access, item not externally managed |
| Card badge | item has a priority |
| Table / my-items Priority column | that board has priorities |
| Filter, group-by option, matrix entry | board has priorities |

For a my-items group whose board query has not resolved yet, the column
falls back to "any entry in the group carries a priority", so the table
does not flicker a column in and out.

## Risks / Trade-offs

- **Renumbering rewrites every row of a board's priority list on each
  mutation** → bounded at 10 rows inside one transaction; the write
  volume is far below a single item move.
- **`MyBoardItem.priority` is a denormalized copy** → it is read-only
  and recomputed on every listing, exactly like `columnTitle`, and both
  are invalidated by the same signal.
- **Client-side matrix diverges if a board grows very large** → the
  board view already renders every item as a card, so the matrix is not
  the first thing to break; if it ever is, the pivot moves behind an
  endpoint without changing the dialog's contract.
- **Priority filter uses OR while the tag filter uses AND** → the
  filter menu shows a per-entry count, so the outcome of a multi-select
  is visible before it is applied.
- **Adding a Priority column shifts the table layouts** → gated on the
  board actually having priorities, so existing boards (which get none
  by migration) are untouched until an admin opts in.

## Migration Plan

1. Migration `20260828_09_board_priorities`: create `board_priorities`
   (`id`, `board_id` → `boards.id` `ON DELETE CASCADE`, `name`, `color`
   nullable, `order_number` integer, index on `board_id`) and add a
   nullable plain `items.priority_id`. The column is `order_number`
   rather than `order` because `order` is a reserved SQL word; the API
   type keeps the plain name `order`. No data is written: existing
   boards deliberately end up with an empty priority list, which every
   new surface treats as "priorities not in use".
2. The `down` migration drops `items.priority_id` and the table, losing
   only priority data — every other item field is untouched, so a
   rollback degrades boards to their pre-change behavior rather than
   breaking them.
3. Backend, then frontend: the API tolerates an absent `priorityId`
   throughout, so a backend deployed ahead of the frontend is a no-op
   and a frontend ahead of the backend simply sees empty priority lists.
4. Board deletion and purge need no new code: `cascadeDeleteBoards`
   relies on the FK cascade from `boards`, which the new table joins by
   declaring `board_id` the same way `board_columns` does.

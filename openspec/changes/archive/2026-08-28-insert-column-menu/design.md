## Context

See `proposal.md` — Why. What shapes the approach is that the backend
half already exists:

- `POST /boards/:boardId/columns` forwards `req.body.position` to
  `BoardsService.addColumn`, which uses it verbatim and only falls back
  to `max(position) + POSITION_STEP` when it is `undefined`
  (`BoardsService.ts:959`). `BoardsApi.addColumn` already declares
  `position?: number` and passes the whole options object through.
- The one place the position is dropped is the frontend action:
  `BoardActions.addColumn` is typed `(title: string) => Promise<void>`
  and `BoardPage.tsx:167` calls `boardsApi.addColumn(boardId, { title })`.
- `positionBefore(sorted, index)` in `grouping.ts` already computes the
  midpoint position used for both item drops and the column Move
  left/right entries, and columns are `{ position: number }` values, so
  it applies to them unchanged.
- The column menu lives in `ColumnLane`, one instance per column. The
  add-column title field lives in `KanbanView` as a single
  `addingColumn` boolean plus a `columnTitle` string, rendered after the
  lanes and gated on `board.columns.length === 0`.

## Goals / Non-Goals

**Goals:**

- One inline-title flow shared by the empty-board affordance and both
  insert entries, so the three cannot drift in behavior.
- The new column is created at its final position in a single request —
  no create-then-reorder, which would flash the column at the end of the
  board and leave a wrong order if the second request failed.

**Non-Goals:**

- Touching the backend, the API client, or the REST contract. Position
  support is already there; only the frontend action signature is wrong.
- Reinstating the trailing "+ Add column" lane on non-empty boards. That
  is the space the earlier change deliberately reclaimed.
- Adding column creation to the table view, which has no column menu and
  today offers no column management at all.
- Drag-to-reorder for columns, or any change to Move left / Move right.

## Decisions

**Widen `BoardActions.addColumn` to `(title, position?)` rather than add
a second action.**
The alternative — a separate `insertColumn` action — would duplicate the
`guarded(...)` wrapper and the invalidation it triggers for no gain,
since the backend distinguishes the two cases only by whether `position`
is present. The empty-board caller keeps passing one argument.

**Compute the position on the client with `positionBefore`, not with a
server-side "insert relative to column X" API.**
An anchor-based API (`{ before: columnId }`) would be more robust against
two users inserting concurrently, but it means a new request shape, a new
service branch, and backend tests, for a race whose worst outcome is two
columns landing in an arbitrary relative order that either user can fix
with Move left/right. The client already computes positions this way for
item drops and column moves; matching that keeps one model of ordering in
the codebase. "Insert before index `i`" is `positionBefore(columns, i)`
and "insert after index `i`" is `positionBefore(columns, i + 1)` — the
same expressions the Move entries already use.

**Replace `addingColumn: boolean` with `insertAt: number | undefined`
holding the target index, and render the title field in that slot.**
Keeping the boolean and adding a separate index would allow the
inconsistent state "adding, but nowhere". A single optional index makes
"not adding" and "adding at slot n" the same field, and the empty-board
case is just `insertAt === 0`. The field renders between lanes at its
slot so the user sees where the column will land while typing, rather
than typing at the end of the board and watching it jump.

**Put the two entries at the top of the column menu, above Move
left/right.**
The menu is ordered by how much it changes the board: creating outranks
reordering, which outranks recoloring, which outranks deleting. Placing
them last, next to Delete, risks a misclick on a destructive entry.

**Keep the state in `KanbanView`, not in `ColumnLane`.**
The field is rendered between lanes, so it cannot live inside the lane
whose menu opened it. `ColumnLane` gets two callbacks (`onInsertBefore`,
`onInsertAfter`) alongside the existing `onRequestDelete`, matching the
pattern already used for delete.

## Risks / Trade-offs

- **Concurrent inserts at the same slot get an arbitrary order** → Both
  columns are created; neither is lost, and Move left/right fixes the
  order. Accepted, as above — the same trade-off the existing Move
  entries and item drag-and-drop already make.
- **Repeated inserts into the same gap halve the position each time**
  (`positionBefore` returns the midpoint), so a pathological sequence
  could exhaust float precision → Reaching it takes ~50 consecutive
  inserts into the identical gap with no intervening reorder; the item
  positions have carried this property since the first release without
  trouble. Not addressed here; a position-renormalization pass would be
  its own change covering items too.
- **The menu grows from four entries to six** → Still short enough to
  read without scrolling, and the two additions are grouped at the top
  rather than interleaved with the existing entries.

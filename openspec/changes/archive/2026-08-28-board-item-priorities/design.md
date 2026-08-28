# Design — board-item-priorities

## Context

See `proposal.md` for motivation and `specs/boards/item-priorities/spec.md` for behavior. Relevant current state:

- Types live in `plugins/boards-common/src/types.ts`. Columns are the closest analogue for a per-board, ordered, optionally-colored definition list: `BoardColumn` with float `position` and `color?: ColumnColor` from the fixed `ALL_COLUMN_COLORS` palette (`red` and `orange` exist, as the defaults need). `BoardWithContext` already carries `columns` on `GET /boards/:id`.
- Tags are the analogue for the per-item side: `ItemFilter`/`itemMatchesFilter` in `boards-common/src/filter.ts`, tag filter menu in `ItemFilterBar.tsx`, `'tags'` mode in `components/grouping.ts`, `set-item-tags` action.
- Backend: hand-rolled migration list in `plugins/boards-backend/src/database/migrations.ts` (+ row typings in `tables.ts`); `BoardsService.ts` holds the column CRUD incl. the delete-with-`moveItemsTo` `ConflictError` pattern; `router.ts` exposes `/boards/:boardId/columns[...]`; `actions.ts` exposes zod-typed agent actions; `createBoard` seeds `DEFAULT_COLUMNS`; `duplicateBoard`/`copyItemsInto` copy columns and item fields.
- Frontend: `api.ts` (`BoardsApi`/`BoardsClient`), `queries.ts` (TanStack Query + signals), `useBoardActions.ts`; surfaces in `BoardView.tsx` (cards), `TableView.tsx`, `MyItemsPage.tsx`, `ItemDrawerFields.tsx`, `ItemMenu.tsx`, `ItemFilterBar.tsx`, `BoardHeader.tsx`/`BoardDialogs.tsx` (board menu + dialog registry), `BoardSettingsDialog.tsx` (entity refs today), `AssignedItemsWidget.tsx`; shared chips in `StatusBadge.tsx` (`ColorDot`, `colorHex`).
- Tests: backend against in-memory SQLite via `service/testUtils.ts` and `router.test.ts` (supertest); frontend via `components/__testUtils__/testHelpers.tsx` factories.

## Goals / Non-Goals

**Goals:**

- One coherent `Priority` model shared end to end, reusing the existing column color palette and the existing filter/grouping/menu/dialog infrastructure.
- Admin-only priority configuration inside the existing board settings dialog.
- All surfaces stay untouched for boards without priorities.

**Non-Goals:**

- No agent/MCP actions for managing priority *definitions* (items gain `priorityId` in `add-item`/`update-item`/`list-items`; definition CRUD via REST only — can be a follow-up).
- No sorting of views by priority, no server-driven filter counts, no priority on the "Boards" widget.
- No renaming of the `ColumnColor` palette types; priorities simply reuse them.

## Decisions

1. **Integer `order`, renumbered transactionally — not float `position`.**
   Columns use gap-based float positions because lists can be long and drag-heavy. Priorities are capped at 10 and the spec exposes the order *number* (1 = highest) as user-visible data. Storing the integer directly and rewriting all rows of a board on insert/reorder/delete (≤10 rows, one transaction) keeps the stored value identical to the displayed one. Alternative (float position + derived index) rejected: two representations of the same thing and extra mapping in every payload.

2. **Model: `BoardPriority { id, boardId, name, color?: ColumnColor, order }` in boards-common; `BoardWithContext.priorities: BoardPriority[]`.**
   The board detail response already carries the column config; priorities ride along the same way, so every board surface has the definitions without extra fetches. `BoardItem` gains `priorityId?: string`; `ItemUpdate` gains `priorityId?: string | null` (null clears). `MyBoardItem` gains a resolved `priority?: { name, color?, order }` so my-items and the home widget need no board fetches. `NewItem` gains `priorityId?` so create paths (incl. actions) can set it.

3. **Storage: `board_priorities` table + nullable `items.priority_id`.**
   New migration appended to `migrations.ts` (e.g. `20260828_01_priorities`): `board_priorities(id, board_id FK→boards CASCADE, name, color nullable, ord int)` and nullable `items.priority_id` (FK, no cascade — the service resolves reassign/drop before deleting a definition; board deletion cascades through `board_priorities` after items are gone, matching existing board purge order). Row typings added in `tables.ts`; migration asserted in `migrations.test.ts`.

4. **Service API mirrors columns, but gated on `admin`.**
   `addPriority` / `updatePriority` (name, color, and target `order` for rearranging) / `deletePriority(…, { reassignTo? , drop? })` in `BoardsService`, each using `requireBoard(principal, boardId, 'admin')` (columns use `write`; the spec makes priorities admin-only, consistent with `updateBoard`). `deletePriority` throws `ConflictError` when items (including archived ones) use it and neither `reassignTo` nor `drop` is given — same contract as `deleteColumn`'s `moveItemsTo`. Name validation like column titles (trimmed, non-empty); color via a `parsePriorityColor` reusing `isColumnColor`; 11th priority → `InputError`. Every mutation emits `emitBoardSignal`.

5. **Routes mirror the columns block.**
   `POST /boards/:boardId/priorities`, `PATCH /boards/:boardId/priorities/:priorityId` (name/color/order), `DELETE /boards/:boardId/priorities/:priorityId?reassignTo=<id>|drop=true`. Items: `PATCH` item accepts `priorityId`; `GET /boards/:boardId/items` accepts repeated `priority=<id>` (OR semantics, like `assignee`), and the `list-items` action passes it through.

6. **Defaults seeded in `createBoard`; duplication copies by order index.**
   `createBoard` seeds `DEFAULT_PRIORITIES = [critical/red, high/orange, medium, low]` next to `DEFAULT_COLUMNS`. `duplicateBoard` copies priorities whenever columns are copied, and `copyItemsInto` maps each item's `priorityId` to the copy's priority with the same order — same index-matching approach the column copy uses.

7. **Change history records the priority *name*.**
   `updateItem`'s field diff writes a `priority` change with old/new priority names (empty for none), resolved at write time. Ids would go stale once a definition is deleted; names keep the timeline readable forever, matching how status changes read.

8. **Frontend: extend the existing generic pieces instead of new frameworks.**
   - `ItemFilter` in `boards-common/src/filter.ts` gains `priorities: string[]` (ids); `itemMatchesFilter` gains the ANY-of check. `ItemFilterBar`/`useItemFilter` gain a priority menu fed by the board's definitions, shown only when ≥1 loaded item has a priority, ordered by `order`, labelled name + `ColorDot` + count derived from the loaded items (client-side, like tag options today).
   - `grouping.ts` gains a `'priority'` mode (board views only; my-items grouping unchanged). `groupItems` needs the board's priority list for group order and the trailing `REST`/"No priority" group; `GroupLabel` renders name, color, count.
   - A small `PriorityChip` (name + color via `colorHex`, neutral fallback) in/next to `StatusBadge.tsx`, used by the kanban card, both tables (column rendered only when some listed item has a priority), the drawer, and `AssignedItemsWidget`.
   - `ItemDrawerFields` gains a priority `Select` (order-sorted, plus "None"); `ItemMenu` gains a "Priority" submenu (board priorities + clear), driven by a new `setItemPriority` in `ItemActions`/`useBoardActions`; the my-items row menu resolves options from that item's board (it already resolves columns per board the same way).
   - `BoardSettingsDialog` gains a "Priorities" section: list ordered by `order` with inline rename, color select (palette + none), up/down reorder, add (disabled at 10), delete. Deleting a used definition opens a confirm step offering "reassign to <other priority>" or "remove priority from items" — modeled on the delete-column dialog in `BoardView`.
   - Matrix: new `BoardDialogKind` `'matrix'`, menu entry in `BoardHeader` (hidden when the board has no priorities), new `PriorityMatrixDialog` rendering columns × priorities (+ "No priority" row when needed) from the already-loaded, already-filtered items; clicking an item opens its drawer.
   - `api.ts`/`queries.ts`: `addPriority`/`updatePriority`/`deletePriority` client methods; item mutations reuse existing invalidation (`invalidateBoard`, `invalidateMyItems`).

## Risks / Trade-offs

- [Renumbering rewrites all priority rows per mutation] → bounded at 10 rows, single transaction; contention is negligible at board-settings frequency.
- [Filter counts computed client-side can lag server state] → same behavior as existing tag/assignee options; the board signal already refreshes items.
- [`priorityId` on items of deleted definitions] → prevented structurally: `deletePriority` clears/reassigns inside the same transaction, covering archived items too.
- [Table column appears/disappears with first/last prioritized item] → intended by spec; sorting state for other columns is unaffected since the column is display-only.
- [Two "color" concepts (column vs priority) sharing one palette type] → deliberate reuse; if palettes ever diverge, introduce a `PriorityColor` alias then.

## Migration Plan

Additive only: new table + nullable item column, applied by the existing migration runner at backend start. Existing boards get **no** priorities (feature invisible) — defaults apply to newly created boards only, per spec. Rollback = migration `down` (drops table and column); no data backfill required.

## Open Questions

None.

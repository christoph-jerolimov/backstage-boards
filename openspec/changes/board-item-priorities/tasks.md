# Tasks — board-item-priorities

## 1. Shared model (boards-common)

- [x] 1.1 Add `BoardPriority` type (`id`, `boardId`, `name`, `color?: ColumnColor`, `order`), `priorities: BoardPriority[]` on `BoardWithContext`, `priorityId?` on `BoardItem`/`NewItem`, `priorityId?: string | null` on `ItemUpdate`, and resolved `priority?` on `MyBoardItem` in `plugins/boards-common/src/types.ts`; verify with `yarn tsc`.
- [x] 1.2 Extend `ItemFilter` with `priorities: string[]` and `itemMatchesFilter`/`isEmptyFilter` with ANY-of priority matching in `plugins/boards-common/src/filter.ts`; verify with new cases in the existing filter unit tests.

## 2. Backend storage and service

- [x] 2.1 Append a migration creating `board_priorities` (`id`, `board_id` FK cascade, `name`, `color` nullable, `ord` int) and nullable `items.priority_id` in `plugins/boards-backend/src/database/migrations.ts`, with row typings in `tables.ts`; verify `database/migrations.test.ts` asserts the new table/column and up/down both run.
- [x] 2.2 Load `priorities` (ordered by `ord`) into `getBoard`'s `BoardWithContext` and into item hydration/`listMyItems` (resolved `priority` on `MyBoardItem`); verify via `BoardsService.test.ts` assertions on board and my-items payloads.
- [x] 2.3 Implement `addPriority`/`updatePriority` (name, color, target `order` with contiguous renumbering) in `BoardsService`, gated on `requireBoard(…, 'admin')`, max 10, trimmed non-empty names, palette-validated color, `emitBoardSignal` on mutation; verify with service tests covering renumbering, the 11-limit, and write-level rejection.
- [x] 2.4 Implement `deletePriority` with `reassignTo`/`drop` resolution over all items including archived ones, `ConflictError` when used and no choice given, renumbering after removal; verify with service tests for reassign, drop, unused delete, and conflict.
- [x] 2.5 Seed `DEFAULT_PRIORITIES` (critical/red, high/orange, medium, low) in `createBoard`; verify a service test asserts a new board's priorities, names, colors, and orders 1–4.
- [x] 2.6 Accept and validate `priorityId` in item create/update (reject ids of other boards, reject on externally managed items, record a `priority` change with old/new names) and support repeated `priority` filter in `listItems`; verify with service tests for set/clear/foreign-id/history/filtering.
- [x] 2.7 Copy priorities in `duplicateBoard` when columns are copied and map item `priorityId` by order index in `copyItemsInto`; verify with a duplication service test.
- [x] 2.8 Add routes `POST/PATCH/DELETE /boards/:boardId/priorities[/:priorityId]` (delete with `reassignTo`/`drop` query) and the items `priority` query param in `router.ts`; verify with `router.test.ts` covering admin-only access and delete conflict status.
- [x] 2.9 Add `priorityId` to `add-item`/`update-item` inputs and `priority` filter to `list-items` in `actions.ts`; verify with `actions.test.ts`.

## 3. Frontend API layer

- [ ] 3.1 Add `addPriority`/`updatePriority`/`deletePriority` to `BoardsApi`/`BoardsClient` in `plugins/boards/src/api.ts`, pass the items `priority` filter through, and extend `testBoardsApi()`/test factories (`testBoard`, `testItem`, `testMyItem`, a new `testPriority`) in `components/__testUtils__/testHelpers.tsx`; verify with `api.test.ts`.
- [ ] 3.2 Add `setItemPriority` to `ItemActions`/`BoardActions` in `useBoardActions.ts` (guarded, invalidating board + my-items) and priority management actions for the settings dialog; verify with `queries.test.tsx`/hook coverage and `yarn tsc`.

## 4. Priority configuration UI

- [ ] 4.1 Add a "Priorities" section to `BoardSettingsDialog.tsx`: ordered list with inline rename, color select over the palette (incl. none), up/down reorder, add (disabled at 10), delete; verify with `BoardSettingsDialog.test.tsx` covering add, rename, reorder renumbering, and the 10 cap.
- [ ] 4.2 Implement the delete-used-priority step offering reassign-to-another or drop, wired to `deletePriority`; verify with a dialog test for both choices and for plain deletion when unused.

## 5. Display, filter, grouping

- [ ] 5.1 Add a `PriorityChip` (name + `colorHex`, neutral fallback) and show it on kanban cards (`BoardView.tsx`) and in the item drawer; verify with `BoardView.test.tsx` asserting chip presence/absence.
- [ ] 5.2 Show a priority column in `TableView.tsx` and `MyItemsPage.tsx` only when at least one listed item has a priority; verify with table tests for both states.
- [ ] 5.3 Add the priority filter to `ItemFilterBar.tsx`/`useItemFilter` — offered only when ≥1 item has a priority, ordered by `order`, entries showing color dot and item count, ANY-of matching, cleared by the bar's clear action; verify with `ItemFilterBar.test.tsx`.
- [ ] 5.4 Add the `'priority'` group mode to `grouping.ts` and the board group-by select — groups ordered by `order` with a trailing "No priority" group, labels with name, color, and count; verify with grouping unit tests and a `BoardPage`/`BoardView` grouping test.

## 6. Editing surfaces

- [ ] 6.1 Add a priority `Select` (order-sorted + "None") to `ItemDrawerFields.tsx`, write-access gated and read-only for externally managed items; verify with an `ItemDrawer` test.
- [ ] 6.2 Add a "Priority" submenu (board's priorities + clear) to `ItemMenu.tsx`, resolving options from the item's own board in the my-items rows; verify with `ItemMenu.test.tsx` and a `MyItemsPage.test.tsx` case.

## 7. Home page widget

- [ ] 7.1 Show each item's resolved priority in `AssignedItemsWidget.tsx` when set; verify with `AssignedItemsWidget.test.tsx`.

## 8. Matrix dialog

- [ ] 8.1 Add a `'matrix'` `BoardDialogKind`, a board-menu entry in `BoardHeader.tsx` hidden when the board defines no priorities, and a `PriorityMatrixDialog` rendering columns × priorities (+ "No priority" row when needed) from the loaded, filtered items, opening item details on click; verify with a new dialog test covering cell placement and the no-priorities case.

## 9. Verification

- [ ] 9.1 Run `yarn tsc`, `yarn lint`, and `yarn test` across the repo and fix fallout; verify all pass.
- [ ] 9.2 Walk the spec scenarios end to end against a running app (defaults on a new board, config CRUD incl. reassignment, card/table/filter/grouping, drawer/menu edits, widget, matrix) and confirm boards without priorities show no priority UI.

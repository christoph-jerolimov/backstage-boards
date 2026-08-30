# Tasks — Board Drop Indicator and Keyboard Navigation

## 1. Shared selection state

- [x] 1.1 Extract `SelectionHandle` and a `useItemSelection()` hook into its own module (e.g. `plugins/boards/src/components/useItemSelection.ts`), returning the existing handle shape plus `clear()`; verify with a new unit test covering toggle, setMany, and multi-id behaviour.
- [x] 1.2 Lift selection out of `TableView` into `BoardPage`: instantiate the hook there (writers only), pass `selection` into `TableView`, and move `BulkActionsBar` rendering to `BoardPage` above whichever view is active; verify `TableView.test.tsx` still passes (adjust harness to provide the selection prop) and that switching views in `BoardPage` keeps the selection (new `BoardPage` test).
- [x] 1.3 Render selected state on board cards: pass `selection` into `BoardView`, mark selected cards with a distinct outline/tint + checked indicator (never on read-only/external items), verify via a `BoardView` test asserting the marking appears for a selected id and not for readers.

## 2. Drag-and-drop drop indicator

- [x] 2.1 Add a pure drop-position helper (e.g. `dropPositionAt(sectionItems, insertIndex)` reusing `positionBefore`) that always computes against the visible section order (group section or ungrouped lane), and unit-test it in `grouping.test.ts` including the grouped-lane case that today mis-targets.
- [x] 2.2 Implement gap drop zones in `ColumnLane`: a zone before each card and after the last card of every rendered section (plus a visible indicator state for the empty-lane drop), each accepting `DRAG_TYPE` and calling `moveItem` with the position from 2.1; card-level drop delegates to "insert before me" with the same section-scoped math.
- [x] 2.3 Style the indicator: hovered zone renders a clear insertion line/gap, replacing the card `boxShadow` hack, keeping the dragged card dimmed and the lane tint for the empty case; verify visually via `yarn start` (board with groups, empty column, end-of-column) and screenshot for the docs.
- [x] 2.4 Add tests for the drop wiring where jsdom allows: assert zones render per gap (count/order, per group section) and that the zone→`moveItem` callback passes the expected `{columnId, position}`; verify `BoardView.test.tsx` passes.

## 3. Board card roving focus and arrow navigation

- [x] 3.1 Add roving-tabindex state to `BoardView` (focused item id; `tabIndex` 0/-1 on cards; visible focus style distinct from the selected marking) and Arrow Up/Down/Left/Right handling over the visible per-column orders (grouped sections included, empty columns skipped, edges keep focus); verify with `BoardView` tests driving arrows via user-event.
- [x] 3.2 Keep focus stable across data changes: re-focus the focused item's card after re-render/move and pick a successor (next → previous → neighbouring column) when it disappears; verify with a test that archives/moves the focused item.

## 4. Shared focused-item shortcuts

- [x] 4.1 Implement the shared shortcut handler (Ctrl+Left/Right move via `actions.moveItem`, Space toggles selection, digit → priority by `order` with `0`→10 and no-op when absent, Delete archives) with the scoping guards (`event.target` is the item element, no extra modifiers, readonly ⇒ navigation/Enter only, `preventDefault` on handled keys); verify with unit tests per key including the guard cases.
- [x] 4.2 Extend the menu stack for keyboard opening: `ItemMenu` gains `initialSubmenu` (move/assignee/due/priority rendered as a flat menu), `useRowMenu` gains `openForItem(item, anchorEl, initialSubmenu?)` anchored at the focused element, Escape/selection returns focus to the item; verify with `ItemMenu`/`RowMenu` tests.
- [x] 4.3 Wire the handler + menu opening into `BoardView` cards (Enter now opens the menu — "Open details" stays its first entry); verify with `BoardView` tests: Enter opens the menu, `s` opens the column list and choosing one calls `moveItem`, `a`/`d`/`p` open their menus, digits call `setItemPriority`, Delete calls `deleteItem`, Ctrl+Right moves to the next column and keeps focus, and none of it fires for readonly/external cards.

## 5. Table row focus and shortcuts

- [x] 5.1 Make table rows focusable as complete rows with a visible focus indicator and register row refs in render order across the per-group `ItemsTable`s; Arrow Up/Down walk that flattened order (crossing group boundaries), Left/Right do nothing; verify with `TableView` tests including a grouped table.
- [x] 5.2 Wire the shared shortcut handler into rows (Space = checkbox toggle, Ctrl+Left/Right = status to neighbouring column, Enter/s/c/m/a/d/p/digits/Delete as on cards) without breaking row click → drawer or the existing checkbox/context-menu behaviour; verify with `TableView` tests mirroring 4.3.

## 6. Validation, docs, and finish

- [x] 6.1 Update `docs/features/board.md` (drop indicator now real, keyboard reference table) and `docs/features/table.md` (row focus, shortcuts); verify `mkdocs`/docs render is sane by proofreading the generated markdown.
- [x] 6.2 Run the full verification: `yarn tsc`, `yarn lint`, `yarn prettier:check`, and `yarn test` for `plugins/boards`; verify all pass.
- [x] 6.3 Manual end-to-end pass with `yarn start`: drag with indicator in flat/grouped/empty/end positions, full keyboard walk (arrows, Ctrl+arrows, Space + bulk bar in both views, Enter/s/a/d/p menus, digits, Delete, focus restore), reader and externally-managed items unaffected; note anything off and fix before closing the change.

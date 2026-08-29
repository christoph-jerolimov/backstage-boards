## 1. Sorting and persistence groundwork

- [x] 1.1 Extend `grouping.ts`: add `createdAt` and `updatedBy` to `ITEM_SORT_COLUMNS` and `sortItems`; verify with new `grouping`/`TableView` unit cases sorting by creation time and by updater.
- [x] 1.2 Add the shared column model plus `useVisibleColumns(key)` hook (new `tableColumns` module; bucket `boards-table-columns`, key = board id or `'my-items'`, visible-id array, defaults on absence, unknown ids dropped, `title` always included) and the `ColumnsMenu` dropdown component; verify with unit tests using `mockApis.storage` covering defaults, stored values, toggling, and independent keys.

## 2. Table view

- [x] 2.1 Introduce the `TABLE_COLUMNS` model in `TableView.tsx`, render header and cells from the visible subset (Priority still gated on `showPriority`), and add the Created and Updated by columns with sortable headers; verify via reworked `TableView.test.tsx` (new default header set, enabled columns render their data, sorting still works).
- [x] 2.2 Add the configure-columns dropdown to the board table view (`Configure columns` icon button above the table, one instance shared by grouped mode, ✓-marked menu entries, Title not offered) wired to `useVisibleColumns(board.id)`; verify with unit tests toggling columns on/off and asserting persistence into the storage bucket.
- [x] 2.3 Give the my-items listing the same treatment in `MyItemsPage.tsx`: the shared column model (title column labelled "Item", Board column untouched by the menu, no header sorting), the Assignees column joining the defaults, and its own `ColumnsMenu` wired to `useVisibleColumns('my-items')`; verify via reworked `MyItemsPage.test.tsx` header/toggle/persistence cases.

## 3. Verification

- [x] 3.1 Run the full plugin checks (`yarn workspace @internal/plugin-boards test`, `yarn tsc`, `yarn lint:all`, `yarn prettier:check`) and the functional Playwright suite (`--project=@internal/plugin-boards --no-deps`, fresh backend) and verify everything passes.
- [x] 3.2 Regenerate the `board-table` and `my-items` screenshot baselines (light and dark), visually review the new default column sets and the configure buttons, and confirm no other baselines change.

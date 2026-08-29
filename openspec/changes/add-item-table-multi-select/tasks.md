# Tasks

## 1. Bulk mutations

- [x] 1.1 Add the `BulkActions` handle to `useBoardActions.ts`
      (`moveItems(itemIds, columnId)`, `updateItems(entries:
      {itemId, update}[])`, `archiveItems(itemIds)`), each fanning out
      over `boardsApi.moveItem` / `updateItem` / `deleteItem` with
      `Promise.allSettled`, then one `invalidateBoard`, surfacing the
      first rejection via `setError`; expose it on `BoardActionsHandle`
      and hand it from `BoardPage` to `TableView`. Verify with new
      cases in `useBoardActions` coverage (or a `TableView.test.tsx`
      harness): all items are called, one invalidation happens, and a
      single rejected call sets the error while the others still run.

## 2. Row selection

- [x] 2.1 Add id-based selection state to `TableView.tsx`
      (`ReadonlySet<string>` next to `sort`), derive `selectedItems`
      by intersecting with `items`, and pass a selection handle to
      `ItemsTable`. Render a leading checkbox column (only when
      `canWrite`) with a BUI `Checkbox` per row — `aria-label` naming
      the item, `isDisabled` for `externalManager` items — that
      toggles the id without opening the drawer. Verify with
      `TableView.test.tsx`: readers see no checkboxes, a writer can
      check a row, the external item's checkbox is disabled, and
      toggling a checkbox does not call `openItem`.
- [x] 2.2 Add the per-table select-all header checkbox: checked when
      every selectable row of that table is selected, indeterminate
      when some are (use `react-aria-components`' `Checkbox` if BUI's
      does not forward `isIndeterminate`), toggling between selecting
      all selectable rows and clearing the table's rows. Verify with
      `TableView.test.tsx`: select-all selects the group's rows but
      not external items, and unchecking one row makes the header
      indeterminate.
- [x] 2.3 Keep the selection across grouping: selection lives in
      `TableView` only, so grouped mode reuses the same set for every
      group's `ItemsTable`. Verify with `TableView.test.tsx`: select
      two items with `groupBy="none"`, re-render with
      `groupBy="assignee"`, both stay selected, and an item with two
      assignees shows a checked box in both groups while counting once
      in the bar's `2 selected` label.

## 3. Bulk-actions bar

- [x] 3.1 Create `BulkActionsBar.tsx`: a `Flex` toolbar rendered by
      `TableView` above the tables only when `canWrite` and at least
      one item is selected, showing `{n} selected`, a Clear button,
      and the Archive button (calls `bulk.archiveItems` with the
      selected ids, then drops them from the selection). Verify with
      `TableView.test.tsx`: no bar without a selection, the bar
      appears after selecting, Clear empties the selection, and
      Archive calls `deleteItem` for each selected id and hides the
      bar.
- [x] 3.2 Add the Status dropdown listing all board columns with `✓ `
      when all selected items are in that column and `– ` when some
      are; choosing a column calls `bulk.moveItems` for the selected
      items not already in it. Verify with `TableView.test.tsx`:
      mixed selection shows dashes, uniform selection shows one
      checkmark, and choosing a column moves every selected item.
- [x] 3.3 Add the Priority dropdown, rendered only when
      `board.priorities.length > 0`, listing priorities in order plus
      `No priority`, with the same ✓/– markers (`No priority` marks
      against `!item.priorityId`); choosing sets or clears
      `priorityId` via `bulk.updateItems`, skipping items already at
      the target. Verify with `TableView.test.tsx`: no dropdown on a
      board without priorities, markers for mixed/uniform/no-priority
      states, and bulk set/clear patches the right items.
- [x] 3.4 Add the Assignee dropdown — `Me` first (cached
      `queryKeys.identity`), then `assigneePool` minus me sorted by
      `useProfiles` display name, then `No assignee` — with ✓ when
      every selected item includes the ref and – when some do;
      choosing adds the ref to items missing it, removes it from all
      when all have it, and `No assignee` clears assignees, all via
      `bulk.updateItems`. Verify with `TableView.test.tsx`: marker
      states, add-to-all, toggle-off-all, and clear-all each patch
      the expected per-item assignee arrays.
- [x] 3.5 Add the Due date dropdown with `Today`, `Tomorrow`,
      `This week (Fri)`, and `Remove due date` (reusing `todayISO` /
      `tomorrowISO` / `fridayISO` from `DueDate.tsx`), applying the
      value to every selected item via `bulk.updateItems`. Verify
      with `TableView.test.tsx`: picking Tomorrow patches every
      selected item's `dueDate` and Remove sends `dueDate: null`.

## 4. Verification

- [x] 4.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full`,
      and `yarn workspace @internal/plugin-boards test`; all pass.
- [ ] 4.2 Manually exercise a board with priorities and an external
      item: select across groups, switch group-by (selection stays),
      run each bulk action, archive a batch, and confirm the
      `board-table` e2e screenshot still passes (regenerate once if
      the writer-view checkbox column trips it).

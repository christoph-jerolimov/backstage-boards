# Tasks

## 1. Implementation

- [ ] 1.1 Render the archived items in `ArchivedItemsDialog` as a BUI
      `TableRoot` (`aria-label="Archived items"`, no `onRowAction`) with
      Title (`isRowHeader`), Archived by (`RefDisplay`), Archived
      (`formatDate`), and Actions columns, keeping the purge note above
      the table and the `Loading…` / `No archived items.` states in place
      of it. Verify with `yarn workspace @internal/plugin-boards test
      ArchivedItemsDialog` — the existing cases for the loading gate, the
      item title, the actor link, the purge note, and the empty state all
      still pass.
- [ ] 1.2 Move the Restore button into the Actions cell unchanged
      (`variant="secondary"`, `size="small"`, `restoreItem` → `refresh`
      → `onChanged`). Verify with the existing restore test: clicking
      `Restore` calls `restoreItem('board-1', 'item-1')`, fires
      `onChanged`, and re-lists the archived items.

## 2. Tests

- [ ] 2.1 Extend `ArchivedItemsDialog.test.tsx` to assert the table
      structure: the four column headers are present
      (`getByRole('columnheader', …)`), and the archived date and actor
      render in separate cells of the item's row. Verify the suite passes.

## 3. Verification

- [ ] 3.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full`,
      and `yarn workspace @internal/plugin-boards test`; all pass.
- [ ] 3.2 Open a board with archived items, open the archived-items
      dialog, and confirm the columns line up and Restore returns the
      item to its column.

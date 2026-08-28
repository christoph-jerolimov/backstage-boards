## 1. Extract the shared matrix table

- [ ] 1.1 Move the `<table>` markup, `ToggleBadge`, `toggled`, the two
      unselected `Set<string>` states and the `count`/`rowSum`/
      `columnSum`/`total` arithmetic out of `PriorityMatrixDialog.tsx`
      into a `MatrixTable` component (own file), parameterised by the
      board's columns, the items, the `MatrixRow[]`, the row-header aria
      label, and the table's aria label
- [ ] 1.2 Reduce `PriorityMatrixDialog` to its priority row derivation
      plus the dialog shell around `MatrixTable`, keeping its dialog
      title, caption, width, and aria labels byte-identical
- [ ] 1.3 Verify the refactor is behavior-preserving: run
      `yarn workspace @internal/plugin-boards test PriorityMatrixDialog`
      with `PriorityMatrixDialog.test.tsx` unchanged, plus
      `yarn workspace @internal/plugin-boards tsc`

## 2. The assignee matrix dialog

- [ ] 2.1 Add `AssigneeMatrixDialog.tsx` deriving its rows from
      `groupItems(items, 'assignee')`: one row per assignee group with
      `matches: item => item.assignees.includes(ref)`, and the
      `UNASSIGNED` group last as `REST_LABEL.assignee` with
      `matches: item => item.assignees.length === 0` — emitted only when
      that group exists
- [ ] 2.2 Label the rows with `useProfiles(refs)`'
      `displayName ?? refDisplayName(ref)` as plain text inside the
      toggle (never an `EntityRefLink`), with the ref as the button's
      `title`; verify a `text:` assignee reads as its text without a
      catalog lookup
- [ ] 2.3 Render the dialog shell — title "Assignee matrix", the
      existing 800px/95% width, the "click to leave it out of the sums"
      caption, and a second caption line stating that items with several
      assignees are counted for each of them
- [ ] 2.4 Verify `yarn workspace @internal/plugin-boards tsc` and
      `yarn workspace @internal/plugin-boards lint` pass

## 3. Wiring it into the board page

- [ ] 3.1 Rename the `'matrix'` kind in `BoardDialogKind` to
      `'priorityMatrix'`, add `'assigneeMatrix'`, and mount
      `AssigneeMatrixDialog` in `BoardDialogs` from the `items` prop it
      already receives; update the existing references
- [ ] 3.2 Add an "Assignee matrix…" `MenuItem` to the board actions menu
      in `BoardHeader.tsx` next to "Priority matrix…", ungated by
      `canWrite` and offered on every board; verify a read-only render
      and a board without priorities both still offer it

## 4. Behavior coverage

- [ ] 4.1 Add `AssigneeMatrixDialog.test.tsx` asserting the grid for two
      columns and two assignees: the per-cell counts, each row sum, each
      column sum, the overall total, and that no item titles or buttons
      appear in a cell
- [ ] 4.2 Test that one item assigned to two people shows 1 in both rows
      and an overall total of 2, and that the double-count note is shown
- [ ] 4.3 Test the "Unassigned" row: present with its counts and
      participating in the sums when unassigned items exist, absent when
      every item has an assignee, and last among the rows
- [ ] 4.4 Test that clicking a status header excludes that column — the
      row sums drop it, its own column sum reads 0, the cells stay
      rendered, `aria-pressed` is `false` — and that clicking again
      restores the sums; same for an assignee row header
- [ ] 4.5 Test that reopening the dialog restores the fully selected
      state
- [ ] 4.6 Add a `BoardPage.test.tsx` case opening the assignee matrix
      from the actions menu with a filter active, asserting only the
      filtered items are counted

## 5. Verification

- [ ] 5.1 Run `yarn workspace @internal/plugin-boards test`,
      `yarn prettier:check` and `yarn lint:all`; verify all pass
- [ ] 5.2 Start the app (`yarn start`), open a board with several
      statuses, multi-assignee items and unassigned items, open the
      assignee matrix and verify the counts against the board, then
      unselect a status and an assignee and verify the sums match what
      remains; confirm the priority matrix still behaves as before

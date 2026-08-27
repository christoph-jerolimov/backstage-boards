## 1. Carry the position through the frontend action

- [ ] 1.1 Widen `BoardActions.addColumn` in `BoardView.tsx` to
      `(title: string, position?: number) => Promise<void>` and forward
      the argument from `BoardPage.tsx` into
      `boardsApi.addColumn(boardId, { title, position })`; verify
      `yarn workspace @internal/plugin-boards tsc` passes and the
      existing empty-board add-column test in `BoardView.test.tsx` still
      passes unchanged
- [ ] 1.2 Assert in a `BoardPage.test.tsx` (or `BoardView.test.tsx`) case
      that a call with no position sends a body without a `position` key,
      so the backend keeps appending; verify the new test passes

## 2. Insert affordance in the column menu

- [ ] 2.1 Replace `KanbanView`'s `addingColumn` boolean with
      `insertAt: number | undefined` (the target slot index) and render
      the existing inline title field at that slot rather than only
      after the last lane, keeping the empty-board case working as
      `insertAt === 0`; verify the empty-board flow still creates a
      column via the existing test
- [ ] 2.2 Add `onInsertBefore` / `onInsertAfter` callbacks to
      `ColumnLane` alongside `onRequestDelete`, and add "Insert column
      before" and "Insert column after" `MenuItem`s at the top of the
      column menu above "Move left", gated on `canWrite` like the rest
      of the menu; verify a read-only render offers neither entry
- [ ] 2.3 Compute the created position with
      `positionBefore(board.columns, index)` for before and
      `positionBefore(board.columns, index + 1)` for after, passing it to
      `actions.addColumn`; verify by unit-testing that inserting after
      the first of two columns yields a position strictly between the
      two columns' positions

## 3. Behavior coverage

- [ ] 3.1 Test that "Insert column after" on "Todo" (board: "Todo",
      "Done") calls `addColumn` once with the new title and a position
      between the two, and that no reorder call follows it — covering
      the spec scenario that the column is never placed at the end first
- [ ] 3.2 Test that "Insert column before" on the leftmost column
      produces a position below that column's, placing the new column
      first
- [ ] 3.3 Test that cancelling the inline field (Escape) and confirming
      an empty title both leave `addColumn` uncalled

## 4. Verification

- [ ] 4.1 Run `yarn workspace @internal/plugin-boards test`,
      `yarn prettier:check` and `yarn lint:all`; verify all pass
- [ ] 4.2 Start the app (`yarn start`), open a board with columns, insert
      a column on each side of an existing one and reload; verify both
      land in the expected order and hold across the reload

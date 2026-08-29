## 1. Shared helpers and tables

- [x] 1.1 Add `utilityColumnStyle` and `ActionsCellContent` to `RowMenu.tsx`, then apply them in `TableView.tsx`, `MyItemsPage.tsx`, `BoardListPage.tsx` (favorite column too), and `ArchivedItemsDialog.tsx`: utility columns get `aria-label` + zero-width style and no visible title, actions cells right-align their control; verify `yarn tsc`, `yarn lint:all`, and `yarn prettier:check` pass.
- [x] 1.2 Update the unit tests that assert header texts (`ArchivedItemsDialog.test.tsx`, `MyItemsPage.test.tsx`, and any others that surface) to the new empty-title headers with accessible names, and verify the full plugin suite passes.

## 2. Verification

- [x] 2.1 Run the functional Playwright suite (`--project=@internal/plugin-boards --no-deps`) against the live app and verify it passes (row menus, my-items flows, board list navigation).
- [x] 2.2 Regenerate the `board-table` and `my-items` screenshot baselines (light and dark), visually review the narrow, unlabelled, right-aligned utility columns, and confirm no other baselines change.

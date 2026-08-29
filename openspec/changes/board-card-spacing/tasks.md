## 1. Card layout

- [ ] 1.1 Restructure the `ItemCard` body in `BoardView.tsx`: card content as a `Flex direction="column" gap="1"` (title row first, external note, badge row, avatars, tags), with priority/due-date/checklist badges in one wrapping `gap="2"` row and the `marginTop: 4` wrapper removed; verify `yarn workspace @internal/plugin-boards test` stays green and `yarn tsc`/`yarn lint:all`/`yarn prettier:check` pass.

## 2. Verification

- [ ] 2.1 Run the functional Playwright suite (`--project=@internal/plugin-boards --no-deps`, board-drag included) against the live app and verify it passes.
- [ ] 2.2 Regenerate the `board-kanban`, `board-grouped-by-priority`, and `item-drawer` screenshot baselines (light and dark), visually review the new card spacing, and confirm the untouched baselines (board-settings, priority-matrix, board-table, my-items, home) are not modified.

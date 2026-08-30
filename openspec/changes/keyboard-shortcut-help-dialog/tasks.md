# Tasks — Keyboard Shortcut Help Dialog

## 1. Dialog component

- [ ] 1.1 Create `ShortcutHelpDialog.tsx` with the grouped, data-driven shortcut rows (navigation + focused-item actions; rows flagged `needsWrite`/`needsPriorities`), rendered as a compact BUI `Dialog` with key badges; verify with a component test asserting all rows for a writer on a board with priorities.
- [ ] 1.2 Filter rows by access and priorities: no mutating rows for readers, no priority/digit rows without priorities, navigation always present; verify with tests for both filtered cases.
- [ ] 1.3 Add a drift-guard test asserting the dialog documents every key `handleItemShortcut` handles (Ctrl+arrows, Space, Enter, s/c/m, a, d, p, digits, Delete); verify it fails when a row is removed.

## 2. The `?` listener

- [ ] 2.1 Add the document-level `?` keydown handling to `BoardPageContent` (open state + `ShortcutHelpDialog` mount) with the guards from the design (key match, no ctrl/meta/alt, `defaultPrevented`, editing/overlay target check); verify with `BoardPage` tests: `?` opens the dialog, `Escape` closes it, `?` typed into the search field does not open it, and `?` with a card focused opens it.
- [ ] 2.2 Confirm reader access: `?` works without write access and shows the filtered list; verify with a `BoardPage` test rendering a read-only board.

## 3. Docs and finish

- [ ] 3.1 Document `?` in `docs/features/board.md`'s keyboard section (and add it to the shortcut table) plus one-line mentions in the root and frontend README keyboard bullets; verify by proofreading.
- [ ] 3.2 Run `yarn tsc`, `yarn lint`, `yarn prettier:check`, and the plugin's jest suite; verify all pass.
- [ ] 3.3 Check the dialog in the running app (`yarn start`): open via `?` from the page, from a focused card, and in the table view; confirm the search-field guard and Escape; verify visually and fix anything off.

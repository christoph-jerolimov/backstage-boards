# Tasks — Keyboard Aliases, Home/End, and Alt-Arrow Item Moves

## 1. Shared handler

- [x] 1.1 Rebind the column move in `itemShortcuts.ts` from Ctrl+Arrow to Alt+Arrow (alt-only modifier check, WIP guard and edge swallowing kept) and add Alt+Up/Down handling via a new optional `reorder` callback (swallowed when absent); verify with updated `itemShortcuts.test.ts` covering the new chords, the reorder callback, edges, readonly, and that Ctrl+Arrow is no longer handled.

## 2. Views

- [x] 2.1 `BoardView`: provide the `reorder` callback (positionBefore against the column's position-sorted list, no-op at the edges, focus retained) and extend the navigation switch with `j`/`k`/`h`/`l` aliases and Home/End (first/last card of the column); verify with `BoardView` tests for aliases, Home/End, Alt+Arrow move, and Alt+Up/Down reorder calling `moveItem` with the expected position.
- [x] 2.2 `TableView`: extend the capture handler with `j`/`k`, Home/End (first/last row across groups), and swallow `h`/`l` like the arrows; verify with `TableView` tests incl. Alt+Arrow status move and that Alt+Up/Down does nothing.

## 3. Dialog, docs, specs

- [x] 3.1 Update `ShortcutHelpDialog` rows (Alt badges for the move, new reorder row, aliases and Home/End in the navigation rows) and the drift-guard test (`alt:` prefix, new handled-keys list); verify the dialog tests pass.
- [x] 3.2 Update `docs/features/keyboard.md` and the README keyboard bullets for the new bindings; regenerate the `keyboard-shortcuts` screenshot baselines (light + dark) with the settle-wait test; verify the screenshot test passes against them.
- [x] 3.3 Run `yarn tsc`, lint, prettier, and the plugin jest suite; verify all pass, then check the new keys in the running app (Alt+arrows especially, confirming no browser history navigation) and archive the change.

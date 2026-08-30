# Keyboard Aliases, Home/End, and Alt-Arrow Item Moves

## Why

The board's keyboard model uses Ctrl+Arrow to move items, which
collides with common browser/OS chords, and offers no vim-style
aliases (`j`/`k` already navigate the item drawer on this very
codebase), no first/last jump, and no way to reorder a card within its
column without a pointer.

## What Changes

- **Moving the item switches from `Ctrl+←`/`Ctrl+→` to `Alt+←`/
  `Alt+→`** (**BREAKING** for keyboard users of the old chord), making
  Alt+arrows consistently "move the item" while plain arrows move the
  focus.
- **`Alt+↑`/`Alt+↓` reorder the focused card within its column** on
  the kanban view (position-based, like a drag); inert in the table
  view, whose order is sorting/grouping.
- **Navigation aliases**: `j`/`k` act as `↓`/`↑` in both views;
  `h`/`l` act as `←`/`→` on the board (and are inert in the table,
  like the arrows they alias).
- **`Home`/`End`** jump to the first/last card of the current column
  (board) respectively the first/last row (table).
- The `?` dialog and the keyboard docs list the new keys; the drift
  guard covers them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/keyboard-navigation`: the Ctrl+Arrow move requirement is
  replaced by an Alt+Arrow one; the board and table navigation
  requirements gain the aliases and Home/End; a reorder-within-column
  requirement is added; the scoping requirement's browser-default
  language follows the rebind.

## Impact

- `plugins/boards` only: `itemShortcuts.ts` (Alt moves + reorder
  callback), `BoardView`/`TableView` key handling, `ShortcutHelpDialog`
  rows, tests, `docs/features/keyboard.md`, README keyboard bullets,
  and regenerated `keyboard-shortcuts` screenshot baselines.

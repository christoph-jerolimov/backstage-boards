# Keyboard Shortcut Help Dialog

## Why

The board page now has a full keyboard model — arrow navigation plus a
dozen focused-item shortcuts — but the only way to discover it is the
documentation. The standard, expected affordance for this is pressing
`?` to see a cheat sheet, like GitHub or Gmail.

## What Changes

- Pressing `?` anywhere on the board page (kanban or table view,
  including the embedded catalog-entity tab) opens a small dialog
  listing all available keyboard shortcuts, grouped into navigation
  and focused-item actions, each with its key and a short description.
- The dialog closes with `Escape` or its close control, returning the
  user to where they were.
- `?` never fires while typing in a text input or inline editor, or
  while a menu, another dialog, or the item drawer is open — same
  scoping rules as the existing shortcuts.
- Rows that do not apply are omitted: the priority picker and digit
  rows are hidden on boards without priorities, and write-only actions
  are hidden for read-only visitors.
- Docs: the keyboard section in `docs/features/board.md` mentions `?`
  as the in-app reference.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/keyboard-navigation`: adds a requirement for the `?`
  shortcut-help dialog — its content, scoping, and close behaviour.

## Impact

- `plugins/boards` only: a new `ShortcutHelpDialog` component, a `?`
  key listener on the board page (following the drawer's existing
  document-listener pattern), plus tests. No backend, common, or API
  changes.
- Docs: `docs/features/board.md`; one-line mentions in the root and
  frontend README keyboard bullets.

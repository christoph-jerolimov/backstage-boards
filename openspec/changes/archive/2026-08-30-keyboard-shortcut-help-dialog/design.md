# Design — Keyboard Shortcut Help Dialog

## Context

See `proposal.md` for motivation. Relevant current state
(`plugins/boards`):

- The shortcut model lives in `itemShortcuts.ts` (`handleItemShortcut`)
  and fires only on a focused card/row; it does not handle `?` and
  ignores shifted keys, so `?` (Shift+`/` on most layouts) bubbles
  freely from focused items.
- There is exactly one document-level key listener today: the item
  drawer's `Escape` handler (`ItemDrawer.tsx`), guarded by
  `!event.defaultPrevented` — the established pattern for page-scoped
  keys.
- `BoardPageContent` hosts both views and knows `board` (priorities),
  `canWrite`, and the open drawer item; BUI `Dialog` (used by the
  column-delete dialog and `BoardDialogs`) handles Escape, focus trap,
  and the close control itself.

## Goals / Non-Goals

**Goals:**
- One static, glanceable cheat sheet matching the shortcuts exactly as
  specified in `boards/keyboard-navigation` — no drift.
- Same scoping discipline as the shortcuts themselves: never steal a
  typed `?`.

**Non-Goals:**
- No toolbar button or menu entry for opening the help (can be added
  later without spec changes to this dialog).
- No shortcuts on other pages (board list, my-items) — the dialog
  documents the board page and lives there.
- No user-configurable keybindings.

## Decisions

### D1: `?` via a document-level listener in `BoardPageContent`

A small `useEffect` in `BoardPageContent` registers a document
`keydown` listener (the drawer's existing pattern) that opens the
dialog when: `event.key === '?'`, no `ctrl`/`meta`/`alt` (shift is
allowed — `?` is a shifted character), `!event.defaultPrevented`, and
the event target is not inside an editing or overlay context —
`target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="grid"] th')`
is null-checked pragmatically: inputs/editors and open overlays are
excluded; plain cards, rows, and the page body qualify. The drawer
being open is covered by its `[role="dialog"]` overlay. Alternative —
routing `?` through `handleItemShortcut`: rejected, it only fires with
an item focused, and the help must open from anywhere on the page.

Checking `event.key === '?'` (not the physical key) keeps this
layout-independent: whatever chord produces `?` works.

### D2: A static `ShortcutHelpDialog` component

New `ShortcutHelpDialog.tsx` rendering a BUI `Dialog` with a compact
two-column list (key badge, description) in two groups — "Navigate"
(arrows per view, one line for the table difference) and "Focused
item" (Ctrl+arrows, Space, Enter, s/c/m, a, d, p, 1–9/0, Delete). The
rows are data (`{keys, description, needsWrite?, needsPriorities?}[]`)
filtered by `canWrite` and `board.priorities.length > 0`, so the
content cannot silently drift per surface. `<kbd>`-style key badges
use existing BUI tokens (`--bui-bg-neutral-2`, `--bui-border-1`).
Alternative — generating rows from `itemShortcuts.ts`: over-
engineering for a static list; the jest test pinning the rows against
the spec is the cheaper drift guard.

### D3: Dialog state lives in `BoardPage`

A `boolean` state next to the existing `dialog` state (it is not a
`BoardDialogKind`: those are board mutations behind the actions menu;
this one is view help and also available to readers). BUI `Dialog`
provides Escape/close-control behaviour; no focus bookkeeping is
needed beyond what the overlay does.

## Risks / Trade-offs

- [The list drifts from the real shortcuts] → one jest test asserts
  the dialog's rows name every key `handleItemShortcut` handles;
  updating a shortcut fails the test until the help is updated.
- [`?` on keyboard layouts where it is unshifted or dead] → `event.key`
  comparison already covers unshifted layouts; dead-key layouts that
  cannot produce `?` in a keydown have no access — accepted, matching
  the industry pattern.
- [Overlay guard misses an exotic popover] → the guard checks roles
  react-aria always sets (`dialog`, `menu`, `listbox`); worst case the
  help opens over a popover and Escape closes it first — annoying, not
  destructive.

## Open Questions

None.

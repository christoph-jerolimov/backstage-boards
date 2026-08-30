# Design — Keyboard Aliases, Home/End, and Alt-Arrow Item Moves

## Context

See `proposal.md`. The shared action handler (`itemShortcuts.ts`)
today binds Ctrl+Arrow for column moves (with the WIP-limit guard);
plain-arrow focus navigation lives in `BoardView.handleCardKeyDown`
and `TableView.handleKeyDownCapture`. The `?` dialog's rows carry
`covers` keys checked by a drift-guard test.

## Goals / Non-Goals

**Goals:** one modifier story — plain keys move the focus, Alt+arrows
move the item; aliases stay pure aliases (identical behaviour to the
key they alias).

**Non-Goals:** no `n`/`p` (collides with the priority picker), no
user-configurable bindings, no reordering from the table (its order is
sorting/grouping, not position).

## Decisions

- **Alt over Ctrl**: `Alt+←`/`Alt+→` is browser history navigation on
  some platforms, exactly like `Ctrl+←` had its own collisions — the
  handler already calls `preventDefault` on handled keys (including
  the no-op edges), which suppresses that; verified in a real browser.
  The modifier check becomes alt-only (no ctrl/meta/shift).
- **Reorder as a view callback**: `ItemShortcutContext` gains
  `reorder?: (direction: -1 | 1) => void`. The shared handler owns the
  Alt+Up/Down key handling (swallow always when writable, call
  `reorder` when provided); `BoardView` provides it — computing the
  target rank with `positionBefore` against the column's
  position-sorted list (not the grouped visible list, so a reorder is
  always a real position change) — and `TableView` does not, which
  yields the spec's "inert in the table" for free.
- **Aliases in the views**: `j`/`k`/`h`/`l` and Home/End are focus
  navigation, so they extend the views' key switches (mapped onto the
  existing arrow branches), not the shared action handler. Home/End on
  the board target `list[0]`/`list[list.length - 1]` of the current
  column; the table maps them to row index 0 / last.
- **Dialog**: the move row rebinds to Alt badges
  (`covers: ['alt:ArrowLeft', 'alt:ArrowRight']`), a reorder row is
  added, and the navigation rows mention the aliases and Home/End; the
  drift-guard test's prefix parsing gains `alt:`.

## Risks / Trade-offs

- [Muscle memory of Ctrl+Arrow breaks] → called out as BREAKING in the
  proposal; the `?` dialog shows the new chord.
- [Alt+arrow browser navigation on some platforms] → preventDefault on
  every handled Alt+arrow, including edges and the table's inert
  reorder; covered by a real-browser check.
- [Reorder in grouped board views can look like a no-op when the
  neighbouring position sits in another group section] → positions are
  computed against the ungrouped column order, so the change is real
  and visible once ungrouped; accepted, mirrors how grouped lanes
  already treat position.

## Open Questions

None.

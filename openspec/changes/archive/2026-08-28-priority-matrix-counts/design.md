# Design — priority-matrix-counts

## Context

See `proposal.md` and the delta spec for the behavior. Current state: `plugins/boards/src/components/PriorityMatrixDialog.tsx` (from the `board-item-priorities` change, still on this branch) renders a `<table>` of columns × priorities whose cells list each matching item as a `Button` opening the drawer via an `onOpenItem` prop. `BoardDialogs.tsx` passes `items` (already narrowed by the active filters) and `onOpenItem`. Tests live in `PriorityMatrixDialog.test.tsx`.

This change depends on `board-item-priorities`: its delta modifies a requirement that change introduces, so it archives after it — on this branch both are implemented together.

## Goals / Non-Goals

**Goals:**

- Pure presentation rework of the dialog: counts, sums, and client-side selection state.
- Keep the dialog dumb: it still receives the filtered items and derives everything else itself.

**Non-Goals:**

- No server-side aggregation — the items are already loaded for the board view; counting client-side is O(items).
- No persistence of the selection: it is a per-open exploration aid, reset when the dialog reopens.
- No changes to the board-menu entry, its gating, or any other priority surface.

## Decisions

1. **Count client-side from the already-passed `items` prop.** The dialog keeps its `board` + `items` inputs; `onOpenItem` is dropped from its props and from the `BoardDialogs` wiring. Counts are derived per render — no memo needed at board sizes.

2. **Selection is two local `Set<string>` states** (`unselectedStatuses`, `unselectedPriorities`) keyed by column id and priority-row key (priority id or the `no-priority` sentinel), stored as *unselected* sets so the "everything selected" default is the empty set and reopening the dialog resets naturally (state lives in the dialog component, which unmounts with it). The "No priority" row toggles like any priority row, per the spec.

3. **Headers become toggle buttons.** Each status header renders the existing status badge (`StatusChip`/`ColorDot` + title) and each priority row header the priority badge, wrapped in a button with `aria-pressed` reflecting selection. Unselected badges are dimmed (reduced opacity) — visible but visibly out of the sums. Plain counts in cells are text, not buttons.

4. **Sums respect selection; cells do not.** Cell counts always show the true per-combination number (the spec keeps them visible); the sum column counts only selected statuses, the sum row only selected priorities, and the corner total only combinations where both sides are selected. This makes the corner total ≠ row/column sums possible when both axes have unselected entries — that is the defined semantics, not a bug.

## Risks / Trade-offs

- [Dimmed-but-visible unselected cells could be read as "excluded"] → the spec says counts stay visible; only the badge dims, cells keep full opacity.
- [Selection resets on close] → intended (non-goal above); persisting would need state lifting with no user ask behind it.

## Open Questions

None.

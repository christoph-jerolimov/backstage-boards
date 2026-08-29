## Why

The kanban card stacks its metadata — priority chip, due date, checklist badge, assignee avatars, tags — as loose elements with no consistent spacing (one ad-hoc `marginTop: 4` on the priority chip is the only gap). Depending on which fields an item carries, the pieces sit uncomfortably close together and the card reads as a clump rather than distinct facts.

## What Changes

- The card body gets a deliberate layout: the title row, a metadata badge row, the assignees, and the tags become a vertical stack with a consistent gap.
- The small status-like badges (priority, due date, checklist progress) share one horizontal, wrapping row with even spacing instead of stacking flush.
- The ad-hoc `marginTop` on the priority chip goes away.
- No behavior changes: same fields, same conditions for showing them, same click/drag/menu handling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this is purely presentational; no spec-level behavior changes (`skip_specs: true`).

## Impact

- `plugins/boards/src/components/BoardView.tsx` — the `ItemCard` body only.
- Screenshot baselines showing kanban cards must be regenerated: `board-kanban`, `board-grouped-by-priority`, and `item-drawer` (cards visible beside the drawer), light and dark.
- No API, data, or test-locator changes expected; drag/drop and menus are untouched.

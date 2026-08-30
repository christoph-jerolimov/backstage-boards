## Why

Due dates and their urgency colors exist, but finding all overdue items
means eyeballing the board. A one-click toggle in the filter bar turns
"what slipped?" from a scan into a filter — trivially small, and
disproportionately used in standups and triage.

## What Changes

- Add an **Overdue** toggle chip to the item filter bar, labelled with
  the live count of overdue items — "Overdue (4)" — shown only while at
  least one listed item is overdue or the toggle is active.
- Toggling it narrows both views to items whose due date lies before
  today, combined with the other filters by AND, counted in the "n of m
  items" readout, and reset by Clear filters.
- The shared item filter (`ItemFilter` / `itemMatchesFilter`) gains an
  optional `overdue` flag, so the my-items page's filter pipeline picks
  it up the same way.
- The items API accepts an equivalent `overdue=true` query parameter,
  keeping API/filter parity.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: the "Filter and search items" requirement
  gains the overdue quick filter and its API parameter.

## Impact

- `plugins/boards-common/src/filter.ts` — `overdue` flag in the filter
  type, matcher, and emptiness check.
- `plugins/boards/src/components/ItemFilterBar.tsx` — the chip and the
  hook state.
- `plugins/boards-backend/src/router.ts` + `BoardsService.listItems` —
  the `overdue` query parameter.
- Docs: filter-bar feature descriptions in README and `docs/features`.

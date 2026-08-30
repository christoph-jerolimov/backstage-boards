## Why

Triaging a board through the item drawer is open-close-open-close: there
is no way to walk to the neighbouring item. Previous/next controls turn
review sessions into a flow, and the order to walk already exists in the
views.

## What Changes

- The item drawer on the board page gains **previous/next** arrow
  buttons in its header, plus a "n of m" position indicator.
- The **j**/**k** keys navigate to the next/previous item while the
  drawer is open (ignored while typing in an input, textarea, or
  editable area).
- The walk order is the active view's visible order over the filtered
  items: the kanban's columns left-to-right with their (grouped) card
  order, or the table's grouped and sorted row order. To make the
  table's order available, the table's sort state moves up to the board
  page.
- First/last item disable the respective control; navigation updates
  the `item` URL parameter like any drawer open.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: the "Structured details drawer" requirement
  gains the prev/next navigation.

## Impact

- `plugins/boards/src/components/ItemDrawer.tsx` — nav controls + keys.
- `plugins/boards/src/components/BoardPage.tsx` — computes the walk
  order, owns the table sort state.
- `plugins/boards/src/components/TableView.tsx` — controlled sort.
- Frontend only; docs update in `docs/features/item-details.md`.

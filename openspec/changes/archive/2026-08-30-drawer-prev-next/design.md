## Context

The drawer is opened via the `item` URL parameter
(`useOpenItemParam`), and `BoardPage` renders it with the current
item. The kanban's visible order is computed in `BoardView`
(`columnLists`: columns by position, cards by position, grouped lanes
flattened with dedup), and the table's in `TableView` (`flatItems`:
groups, then `sortItems` per group) — but the table's sort state is
component-local. `grouping.ts` exports `groupItems` and `sortItems`.

## Goals / Non-Goals

**Goals:**
- Prev/next + j/k on the board page's drawer, following the active
  view's visible order.

**Non-Goals:**
- No navigation on the my-items or homepage drawers (their hosts have
  their own list semantics; can follow later).
- No wrap-around at the ends.

## Decisions

- **Order computed in `BoardPage`** with the same building blocks the
  views use (`groupItems`, `sortItems`, positions), rather than lifting
  refs out of the views. To mirror the table exactly, the table's sort
  state moves up: `TableView` gains `sort`/`onSortChange` props and
  `BoardPage` owns the state (the insights view falls back to the
  kanban order).
- **`ItemDrawer` nav prop**: `{ prev?, next?, position, total,
  onNavigate }`; buttons render beside the watch control; a keydown
  listener maps `j`/`k`, guarded by a "target is not editable" check
  (input, textarea, contenteditable).
- Items outside the current order (e.g. drawer deep-link while filters
  hide the item) show the drawer without nav controls.

## Risks / Trade-offs

- The order recomputes on every render of the page; trivial cost at
  board sizes.
- Kanban dedup means an item grouped into two lanes is visited once,
  matching the keyboard navigation's behavior.

# Priority Matrix as a Count Matrix

## Why

The priority matrix dialog (introduced by the `board-item-priorities` change) lists every item as a button per cell, which gets noisy on real boards and buries the shape of the data. A count per status × priority combination, with sums, answers the actual question — where is the work concentrated — at a glance, and clickable badges let the user narrow the sums interactively.

## What Changes

- **Counts instead of item buttons**: each matrix cell shows only the number of items with that status and priority; items are no longer listed or clickable in the cells.
- **Sum column and sum row**: a trailing column sums each priority row across the selected statuses, a trailing row sums each status column across the selected priorities, and the corner shows the overall total of the selected combinations.
- **Toggleable headers**: the status badges and the priority badges in the matrix headers can be clicked to unselect and re-select (all selected by default). An unselected status or priority is excluded from the sums; its own cells remain visible but do not count.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-priorities`: The "Status and priority matrix dialog" requirement changes from listing items in cells to showing per-combination counts with sum row/column and toggleable status/priority selection.

## Impact

- **Frontend only**: `plugins/boards/src/components/PriorityMatrixDialog.tsx` and its test; no backend, API, or data model changes.
- The dialog no longer needs an `onOpenItem` callback.
- No breaking changes outside the dialog; its board-menu entry and no-priorities gating stay as they are.

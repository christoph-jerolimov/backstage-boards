# Table Row Menu and Context Menu

## Why

The card's actions menu (open details, move to column, due date) has no
counterpart in the table view, and neither surface supports the
right-click gesture users expect.

## What Changes

- The table gets the same three-dot actions menu at the end of each row.
- Right-clicking a card or a table row opens the same menu at the
  pointer position.

## Impact

- `plugins/boards`: shared `ItemMenu` + pointer-anchored
  `ItemContextMenu`; KanbanView cards and TableView rows wire
  `onContextMenu`; TableView gains `canWrite`/`actions` props.

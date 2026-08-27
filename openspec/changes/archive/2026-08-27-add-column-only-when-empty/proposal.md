# Add Column Button Only on Empty Boards

## Why

The permanent "+ Add column" lane at the end of the board takes
horizontal space on every board. Once a board has its columns, new
statuses are a rare operation and the button is mostly noise.

## What Changes

- The "+ Add column" affordance renders only while the board has no
  columns; boards with columns no longer show it.

## Impact

- `plugins/boards`: KanbanView add-column rendering condition.

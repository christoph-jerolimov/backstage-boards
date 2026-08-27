# Group-By Dropdown

## Why

Grouping is currently a single "Group by assignee" switch. Users also
want to slice a board by due date or tags.

## What Changes

- The switch becomes a "Group by" dropdown with: Not grouped,
  By assignee, By due date, By tags. Works in both board and table view.
- By due date groups by the date (relative labels near today, "No due
  date" last); by tags puts an item into each of its tag groups
  ("Untagged" last), mirroring the multi-membership of assignees.

## Impact

- `plugins/boards`: `grouping.ts` (generic `groupItems` + mode type),
  `GroupLabel` renderer, BoardPage Select, KanbanView/TableView take the
  mode. `grouping.test.ts` extended.

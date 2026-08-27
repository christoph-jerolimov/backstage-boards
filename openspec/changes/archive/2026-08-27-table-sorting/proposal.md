# Table View Sorting

## Why

The table view lists items in board order only; sorting by title, status, creator, or update time is a basic expectation for a tabular view.

## What Changes

- The table view's Title, Status, Created by, and Updated columns become sortable (ascending/descending toggle via the column headers, keyboard accessible through the underlying react-aria table).
- Sorting is client-side over the loaded (already filtered) items; with group-by-assignee active, sorting applies within each group.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: the table view supports sorting by column headers.

## Impact

- `plugins/boards`: `sortItems` helper with unit tests, `TableView` sort state via the react-aria `sortDescriptor`.

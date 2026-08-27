# Item Filtering and Search

## Why

There is no way to narrow a board down to the items that matter — by text, tag, or label. A filter bar in the UI plus backend filter support (usable by actions and future sync modules) closes that gap.

## What Changes

- Board page gets a filter bar: free-text search (title + description), tag multi-select (from tags in use on the board), and label `key=value` filters. Filters apply to both the kanban and table views; filtering is done client-side on the loaded items.
- Backend `listItems` accepts `text`, `tags` (all must match), and `labels` (all key=value pairs must match) filters, exposed as query parameters on the items endpoint.
- New read-only `list-items` action in the actions registry with the same filters.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: items can be filtered by text, tags, and labels in both views and via the API.
- `boards/actions`: a read-only `list-items` action lists a board's items with the same filters.

## Impact

- `plugins/boards-backend`: `listItems` filter options, query param parsing, `list-items` action, tests.
- `plugins/boards`: filter bar on `BoardPage`, pure `filterItems` util with tests.
- `plugins/boards-common`: `ItemFilter` type.

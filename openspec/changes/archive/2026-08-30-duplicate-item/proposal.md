## Why

Recurring work is retyped: there is no way to clone an item that serves
as a template. Boards can be duplicated; items cannot.

## What Changes

- The item menu gains a **Duplicate** entry (writers only) that creates
  a copy of the item on the same board, directly below the original in
  the same column.
- The copy carries the fields: title (suffixed " (copy)"), description
  (as a fresh first version), tags, assignees, due date, priority, and
  the checklist with all entries unchecked. Comments, history, watches,
  and the external-manager flag are not copied; the duplicator becomes
  the creator.
- Implemented as a backend endpoint
  (`POST /boards/:boardId/items/:itemId/duplicate`) so the copy is
  atomic and recorded in the change history as a creation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: new "Duplicate an item" requirement.

## Impact

- `plugins/boards-backend` — `duplicateItem` service method + route.
- `plugins/boards` — API method, item menu entry.
- Docs: item menu docs and README.

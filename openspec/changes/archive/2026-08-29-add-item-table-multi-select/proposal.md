# Multi-Select and Bulk Actions in the Item Table

## Why

Changing the status, priority, assignee, or due date of several items —
or archiving a batch — currently means opening the row menu of every
single item in the table. Boards routinely accumulate dozens of items
that need the same change at once (triage a sprint, hand a set of items
to a colleague, sweep stale items into an archive), so the table needs
row selection with bulk actions.

## What Changes

- The board's table view gets a selection checkbox per item row (and a
  select-all checkbox per rendered table) for users with write access.
  Selection is tracked by item id, so an item that appears in several
  groups (multi-assignee, multi-tag grouping) is one selection, and
  **changing the group-by option keeps the current selection**.
- While at least one item is selected, a bulk-actions bar appears above
  the table showing the selection count and the actions:
  - **Change status** — dropdown listing all board columns.
  - **Change priority** — dropdown listing all board priorities plus a
    "No priority" entry; only offered when the board defines priorities.
  - **Change assignee** — dropdown listing "Me", the board's assignees,
    and a "No assignee" entry; entries toggle the assignee on all
    selected items.
  - **Change due date** — dropdown with the existing quick due-date
    choices (Today, Tomorrow, This week, Remove due date).
  - **Archive** — a button that archives all selected items.
- Dropdown entries reflect the selection's current state: a checkmark
  when **all** selected items already have that value (or include that
  assignee), a dash when only **some** do.
- Externally managed (read-only) items cannot be selected; readers see
  no checkboxes at all.
- Bulk changes fan out over the existing single-item API calls and
  refresh the board once; no new backend endpoint.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: adds requirements for table row selection
  (id-based, surviving group-by changes) and for the bulk status,
  assignee, due-date, and archive actions with their mixed-state
  indicators.
- `boards/item-priorities`: adds a requirement for the bulk priority
  action — offered only when the board defines priorities, with the
  "No priority" entry and mixed-state indicators.

## Impact

- `plugins/boards`: `TableView` (selection state, checkbox column,
  bulk-actions bar), a new bulk-actions component, `useBoardActions` /
  `BoardPage` wiring for fan-out mutations, plus tests. No changes to
  the board (kanban) view, the my-items page, or other tables.
- `plugins/boards-backend`, `plugins/boards-common`: no changes — bulk
  actions reuse `moveItem`, `updateItem`, and `deleteItem` per item.

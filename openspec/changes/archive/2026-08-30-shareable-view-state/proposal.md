## Why

Filters, grouping, sorting, and the view toggle all evaporate per
session and cannot be shared: a colleague cannot be sent "the board,
table view, grouped by assignee, only `bug` items". Encoding the view
state in the URL makes every filtered view a link.

## What Changes

- The board page's view state moves into URL query parameters:
  free-text search (`q`), tags (`tag`, repeated), assignees
  (`assignee`, repeated), priorities (`priority`, repeated), the
  overdue toggle (`overdue=1`), grouping (`group`), the view mode
  (`view`), and the table sort (`sort=field` / `sort=-field`).
- Opening a URL carrying these parameters restores the exact view;
  changing any control updates the URL in place (replace, not push, so
  Back does not walk through every keystroke). Defaults are omitted
  from the URL.
- Clear filters removes the filter parameters; unknown values are
  ignored gracefully.
- The my-items page keeps its session-local filter state (its URL is
  not board-scoped); only the board page becomes shareable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: new "Shareable view state in the URL"
  requirement.

## Impact

- `plugins/boards/src/components/ItemFilterBar.tsx` — the filter hook
  gains a URL-backed state mode.
- `plugins/boards/src/components/BoardPage.tsx` — view, group, and
  sort read/write the URL.
- Frontend only. Docs: `docs/features/board.md` filter-bar section and
  README.

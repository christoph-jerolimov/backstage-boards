## Why

Opening an item from the homepage "Assigned items" card or from the "My items" tab/page currently navigates to the item's board (`/boards/<boardId>?item=<itemId>`) and opens the detail drawer there. That yanks the user out of their current context just to peek at a ticket or make a small edit (change status, due date, leave a comment), after which they have to navigate back. The item drawer is already a self-contained, prop-driven component, so it can be hosted in place.

## What Changes

- Activating an item in the homepage "Assigned items" card opens the item detail drawer directly on the homepage instead of navigating to the board.
- Activating an item row (or choosing "Open details" from the row menu) on the "My items" page and on the "My items" tab of the boards page opens the item detail drawer in place instead of navigating to the board.
- The in-place drawer offers the full detail view (edit fields, status, checklist, comments/timeline, watch) with the same write-permission gating as on the board page; on read-only boards it opens in read-only mode.
- Edits made in the in-place drawer refresh the hosting list (assigned items / my items) as well as the board's cached data, so the row reflects the change immediately.
- Navigating to the board itself stays available (board name links and row menu), and existing `/boards/<boardId>?item=<itemId>` deep links (e.g. from notifications) keep working unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `boards/homepage-widgets`: The "Assigned items" widget requirement changes from "activating an item navigates to that item on its board with details open" to "activating an item opens the item's detail drawer in place on the homepage".
- `boards/item-management`: The "My items sub-page" requirement changes so that clicking an item (and the "open details" row action) opens the item's detail drawer in place instead of navigating to the board; the read-only-board scenario changes from "navigation only" to opening the drawer read-only.

## Impact

- **Affected code** (all in `plugins/boards/src`):
  - `components/AssignedItemsWidget.tsx` — replace `navigate(...?item=...)` with in-place drawer hosting; needs to fetch the entry's board (shared query keys already exist in `queries.ts`).
  - `components/MyItemsPage.tsx` — replace row-activation and "Open details" navigation with in-place drawer hosting; boards are already fetched here via `useBoardsQueries`.
  - New shared drawer-host component/hook that resolves `BoardWithContext` + fresh item for a `(boardId, itemId)` pair and renders `components/ItemDrawer.tsx` with `onChanged` invalidating both the board and my-items caches.
  - Tests: `AssignedItemsWidget.test.tsx`, `MyItemsPage.test.tsx` (navigation assertions become drawer assertions), e2e `home-widgets.test.ts`, `my-items-menu.test.ts`.
- **Unchanged**: `ItemDrawer.tsx` API, board page behavior (`BoardPage.tsx`, `useOpenItemParam`), backend, notification deep-link format.
- **No new dependencies.**

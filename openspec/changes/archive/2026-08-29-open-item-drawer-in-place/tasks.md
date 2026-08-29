## 1. Shared drawer host

- [x] 1.1 Create `plugins/boards/src/components/ItemDrawerHost.tsx` with props `{ boardId, itemId, fallbackItem, onClose }`: resolve the board via `useBoardsQueries([boardId])`, the fresh item via `useItemsQuery(boardId)` (snapshot fallback until loaded), derive `canWrite` (`levelIncludes(board.access, 'write') && !board.archivedAt`) and `tagSuggestions` (union of tags across the board's items), render `ItemDrawer` with `onChanged` invalidating the board and my-items caches, and navigate to `/boards/<boardId>?item=<itemId>` if the board query fails. Verify with `yarn tsc` (or workspace typecheck) passing.
- [x] 1.2 Add `plugins/boards/src/components/ItemDrawerHost.test.tsx` covering: drawer renders with board data, read-only board yields a read-only drawer, an edit triggers board + my-items invalidation, and board-load failure falls back to navigation. Verify with `yarn test ItemDrawerHost` passing.

## 2. My items page and tab

- [x] 2.1 In `plugins/boards/src/components/MyItemsPage.tsx`, replace the `navigate(...?item=...)` calls in `TableRoot onRowAction` and `actionsOf(boardId).openItem` with local `useState` selection rendered through `ItemDrawerHost`; keep board heading/column links and the "open board" menu entry navigating. Verify by running the app: clicking a row on `/boards/my-items` opens the drawer with the URL unchanged.
- [x] 2.2 Update `plugins/boards/src/components/MyItemsPage.test.tsx`: turn the row-activation and "Open details" navigation assertions into drawer-opens-in-place assertions (including the read-only board case and a drawer edit updating the row). Verify with `yarn test MyItemsPage` passing.

## 3. Assigned items homepage widget

- [x] 3.1 In `plugins/boards/src/components/AssignedItemsWidget.tsx`, replace `openItem`'s `navigate` with local selection state rendered through `ItemDrawerHost` (board fetched lazily on open); leave `openBoard` unchanged. Verify by running the app: activating a card item opens the drawer on the homepage.
- [x] 3.2 Update `plugins/boards/src/components/AssignedItemsWidget.test.tsx`: replace the navigation assertion with drawer-opens-in-place assertions, including an edit reflected in the card after `onChanged`. Verify with `yarn test AssignedItemsWidget` passing.

## 4. End-to-end and regression

- [x] 4.1 Update `plugins/boards/e2e-tests/home-widgets.test.ts` and `plugins/boards/e2e-tests/my-items-menu.test.ts` to assert the drawer opens in place (dialog visible, URL unchanged) and closes back to the host page; visually confirm the overlay renders above the homepage widgets. Verify with `yarn playwright test home-widgets my-items-menu` passing.
- [x] 4.2 Regression pass: board page drawer still driven by `?item=` (open a `/boards/<boardId>?item=<itemId>` deep link), boards-page "My items" tab gets the in-place drawer via the shared `MyItemsList`, and full plugin suite is green. Verify with `yarn test plugins/boards` and `yarn lint` passing.

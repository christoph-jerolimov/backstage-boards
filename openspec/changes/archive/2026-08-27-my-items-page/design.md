# Design

## Backend

- `MyBoardItem` in boards-common: `{ item: BoardItem; boardId: string;
  boardName: string; columnTitle: string }`.
- `BoardsService.listMyItems(principal)`:
  - requires a user principal (`NotAllowedError` otherwise);
  - matching refs = `userRef` ∪ `ownershipRefs` (groups included);
  - one query: `item_assignees` filtered by those refs joined to
    non-archived `items`;
  - loads the distinct parent boards, drops archived ones and boards
    where `effectiveLevel` is null (private boards leak nothing — the
    listing just omits them);
  - hydrates via the existing `hydrateItems` and maps in board name +
    column title, ordered by board name then item position.
- Route `GET /my-items` → `{ items: MyBoardItem[] }`. No filter options
  in this iteration.

## Frontend

- `MyItemsPage`: fetches via new `boardsApi.listMyItems()` with a
  TanStack query (`['boards','my-items']`), groups by board (`Map` in
  render), each group: board-name heading linking to
  `<basePath>/<boardId>`, a compact table (Title / Status / Due / Tags)
  where a row click navigates to
  `<basePath>/<boardId>?item=<itemId>`.
- Status: plain `Badge` with the column title (no color context needed
  here); Due uses the existing `DueDateBadge`.
- Routing: `<Route path="my-items" …>` inside `BoardsPage`'s internal
  `Routes` (static segments outrank `:boardId` in React Router v6, no
  conflict), plus a "My items" `ButtonLink` (remix `RiUserReceivedLine`
  or similar list icon) next to "New board" on the list page.
- Signals: reuse the `boards` channel — any board signal invalidates the
  my-items query.

## Testing

- Service tests: cross-board collection with an inaccessible private
  board excluded, group-assignment inclusion, anonymous rejection,
  archived item/board exclusion.
- Playwright smoke: seed two boards + assignments, open /boards/my-items,
  verify grouping and that clicking an item lands on the board with the
  drawer open.

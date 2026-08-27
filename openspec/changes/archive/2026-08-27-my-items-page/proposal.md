# My Items Page

## Why

Users who work across several boards have no single place to see what is
assigned to them; they must open every board and scan for their name. A
"My items" sub-page collects the current user's assignments from all
boards they can access into one view.

## What Changes

- New backend endpoint returning all items assigned to the current user
  (directly or via one of their groups) across every non-archived board
  the user can read, each with its board name and column title for
  context.
- New `/boards/my-items` sub-page listing those items grouped by board:
  item title, status, due date (with the existing urgency colors), and
  tags; clicking an item opens it on its board, and the board heading
  links to the board.
- The board list page links to the new sub-page.

## Impact

- `boards-common`: `MyBoardItem` type (item + board/column context).
- `boards-backend`: `listMyItems` service method + `GET /my-items` route.
- `boards`: `MyItemsPage` component, route registration, list-page link.

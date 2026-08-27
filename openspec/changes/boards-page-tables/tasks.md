# Tasks

## 1. Shared row menu

- [ ] 1.1 Add `RowMenu.tsx` with `useRowContextMenu`, `RowContextMenu`,
      and `RowActionsCell`; rebuild `ItemContextMenu` on it and verify
      the board table's row menu and right-click still open the same
      menu (`yarn tsc`, `yarn lint:all`)

## 2. Boards page

- [ ] 2.1 Remove the "My items" header button from `BoardListPage` and
      verify the "My items" tab and the `/my-items` route still reach
      the listing
- [ ] 2.2 Replace `BoardRows` with a `BoardsTable` (Favorite, Name,
      Entities, Access, Actions) used by both tabs, keeping the empty
      text when a tab has no boards; verify a row click opens the board
      and the star toggles favorite without navigating
- [ ] 2.3 Add `BoardMenu` (Open board, add/remove favorite) to the
      Actions cell and wire right-click on the row; verify both entry
      points open the same menu and the browser menu is suppressed

## 3. My items

- [ ] 3.1 Render each board group in `MyItemsList` as a table (Item,
      Status, Due, Tags, Actions) and verify a row click opens the item
      on its board
- [ ] 3.2 Add `MyItemMenu` (Open item, Open board) to the Actions cell
      and wire right-click; verify from both the tab and the standalone
      page

## 4. Verification

- [ ] 4.1 `yarn tsc`, `yarn lint:all`, `yarn test`, and a smoke run of
      the Boards page covering both tabs, the row menus, right-click,
      and the standalone My items page

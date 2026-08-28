# My Items Menu Parity

## Why

An item's menu on a board page — the card's three-dot menu, the table
row's menu, and the right-click menu, all rendered by `ItemMenu` — offers
Open details, Move to column, Due date, Assignee, and Delete item. The
same item shown in the my-items table (the boards page's "My items" tab
and the `/boards/my-items` sub-page) has a menu with only Open item and
Open board.

That gap was a deliberate deferral: `listMyItems` returns neither the
board's columns nor the caller's access level, so the earlier change kept
a separate `MyItemMenu`. The result is that the fastest place to see
everything assigned to you is the one place where you cannot act on it —
marking an item done, pushing its due date, or handing it over means
opening its board first.

## What Changes

- The my-items table's row menu and right-click menu offer the same item
  actions as a board page: Open details, Move to column (status), Due
  date, Assignee, and Delete item — rendered by the same `ItemMenu`
  component, so the two surfaces cannot drift apart again.
- "Open board" stays, as an extra entry only the my-items table has.
- Each board group resolves its board (columns + access level) so the
  submenus can be built; while that is in flight, and for boards the user
  can only read or for externally managed items, the menu degrades to the
  navigation entries exactly as `ItemMenu` already does for read-only
  boards.
- Acting on a row refreshes the my-items listing and the affected board's
  caches, so a moved item's status, a new due date, or an item that left
  the user's list is reflected without a manual reload.
- The status cell renders the board's status badge (dot + column color)
  instead of a plain chip, matching the board table.

## Impact

- `plugins/boards`: `ItemMenu` gains an optional extra-items slot and a
  narrowed `ItemActions` prop type; `MyItemsPage` drops `MyItemMenu`,
  resolves each group's board, and builds per-board item actions;
  `queries.ts` gains the my-items query key and its invalidation.
- No backend, API, or database changes.

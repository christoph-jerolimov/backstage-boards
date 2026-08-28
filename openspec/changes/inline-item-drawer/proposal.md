## Why

Both places that list a user's assigned items — the "Assigned items" home
page card and the "My items" page/tab — treat an item as a link to
somewhere else. Clicking one navigates to `/boards/<boardId>?item=<itemId>`:
the whole page is torn down, the board loads, and the details drawer opens
there. To act on three items the user makes three round trips through
three boards and has to find their way back each time.

Nothing about the drawer actually requires the board view behind it. It
needs the board (for its columns and the caller's access level) and the
item — both already reachable from anywhere. The navigation is an
implementation detail leaking into the UX.

## What Changes

- The item details drawer becomes **openable in place**, over whatever
  page the user is on, so a user can read a ticket, change its status,
  set a due date, edit assignees, tags or description, and comment
  without leaving the list they started from.

- **"My items" page and Boards-page tab**: clicking an item row, or the
  "Open item" entry in its row/context menu, opens the drawer over the
  list instead of navigating. The open item is reflected in the URL
  (`?board=<boardId>&item=<itemId>`), so the drawer is linkable, survives
  a reload, and closes with the browser's back button. Landing on
  `/boards` with those parameters selects the "My items" tab. "Open
  board" in the same menus still navigates to the board, unchanged.

- **"Assigned items" home page card**: clicking an item opens the drawer
  over the home page. The card keeps its open item in component state
  rather than the URL — the plugin does not own the home page's address,
  and two copies of the card on one home page must not open each other's
  drawers. The board group heading still navigates to the board.

- **The drawer, opened away from its board, names that board** and offers
  a way to open it. This is what keeps the old behavior reachable in one
  click, and it matters most in the card's "status" and "due date"
  grouping modes, where nothing else on screen says which board an item
  belongs to.

- Editing an item from the drawer **refreshes the lists behind it**: the
  my-items listing and the home page cards, not just the board's own
  queries. Moving an item to "Done" from the home page updates the card
  it was opened from.

## Capabilities

### Modified Capabilities

- `boards/item-management`: the "My items" sub-page and tab open an
  item's details in place rather than navigating to its board; the
  details drawer, when opened away from its board, identifies that board
  and offers to open it.
- `boards/homepage-widgets`: the "Assigned items" card opens an item's
  details in place on the home page.

## Impact

- **`boards`** (frontend only): the drawer's overlay/panel chrome is
  extracted from `ItemDrawer` so a loading or error state can use it;
  a new `ItemDrawerHost` loads a board and item by id and renders the
  drawer anywhere; `MyItemsPage` and `AssignedItemsWidget` open it
  instead of navigating; `BoardListPage` honors the deep-link
  parameters; `invalidateBoard` additionally invalidates the my-items
  and board-listing queries.
- **No backend, API, or `boards-common` change.** No new endpoint and no
  new request: the board and its items are fetched with the same queries
  and the same cache keys the board page uses, so opening the board
  afterwards is already warm.
- **No permission change.** The drawer derives write access from the
  board's `access` level exactly as the board page does, and every write
  goes through the same endpoints.
- **`BoardPage` keeps its `?item=` deep link** and its own drawer
  behavior; only the shared chrome underneath it moves.

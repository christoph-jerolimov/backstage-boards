# Full Boards in the Catalog Tab

## Why

The entity page's Boards tab only lists links, forcing users to leave
the catalog to work with a board.

## What Changes

- The Boards tab renders the complete board experience inline: for one
  assigned board the full board view; for several, tabs per board. All
  board features (views, filters, menus, drawer) work in place.

## Impact

- `plugins/boards`: `BoardPage` split into a route wrapper and an
  embeddable `BoardPageContent({ boardId, embedded })`;
  `EntityBoardsContent` renders it (tabbed for multiple boards);
  delete/duplicate navigation uses the absolute boards path so it works
  from the catalog too.

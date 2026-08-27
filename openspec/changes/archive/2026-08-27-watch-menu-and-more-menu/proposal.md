# Watch Menu Button and Board More Menu

## Why

The watch toggle gives no insight into who else is watching, and the board header is getting crowded with flat buttons (Share, Delete). A watch button with a watchers dropdown adds transparency, and a three-dot "more" menu declutters the header.

## What Changes

- Replace the watch `Switch` on the board header and in the item drawer with a shared `WatchButton` component: clicking the main segment toggles watching; a chevron segment opens a dropdown listing all current watchers.
- Backend: new endpoints returning the watchers of a board and of an item (user refs), available to anyone with read access; exposed on the frontend API client.
- Move the Share and Delete buttons on the board header into a new "more" menu opened by a three-dot icon button using the Remix Icons `more-2` icon (via `@remixicon/react`).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/watching-and-notifications`: watchers of a board/item are listable by users with read access; the watch control shows the watcher list.

## Impact

- `plugins/boards-backend`: `BoardsService.listBoardWatchers`/`listItemWatchers`, two GET routes, router tests.
- `plugins/boards-common`: no schema change (watchers are plain ref arrays).
- `plugins/boards`: new `WatchButton` and `MoreMenu` usage in `BoardPage` and `ItemDrawer`; new dependency `@remixicon/react`.

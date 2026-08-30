## Why

Items sometimes land on the wrong board, or work migrates between team
boards. Today the only path is retyping the item and losing its
history.

## What Changes

- The item menu gains a **Move to board…** entry (writers only)
  opening a dialog: pick a target board (searchable list of boards the
  user can write to), then pick one of that board's columns (loaded
  once a board is selected), then **Move**.
- The move creates a new item on the target board carrying the item's
  fields (title, description with its full version history, tags,
  assignees, due date, checklist with its checked state) and its full
  recorded history (change records and comments, with their authors
  and timestamps), and archives the original on the source board.
  Priority is kept only if the target board has a priority with the
  same name; watches stay on the original.
- The moved copy's history gains a "moved from board X" record; the
  archived original stays restorable like any archived item.
- Implemented as one atomic backend operation
  (`POST /boards/:boardId/items/:itemId/move-to-board`), requiring
  write access on both boards and honoring the target column's hard
  WIP limit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: new "Move an item to another board"
  requirement.

## Impact

- `plugins/boards-backend` — `moveItemToBoard` service method + route.
- `plugins/boards` — move dialog, API method, item menu entry.
- Docs: items docs and README.

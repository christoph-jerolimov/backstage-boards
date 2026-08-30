## Context

The board page already opens the drawer from the `item` query
parameter (`useOpenItemParam`), so the permalink format exists; nothing
surfaces it. `ItemMenu` is the shared menu for cards, rows, drawer, and
my-items; it knows the item (with `boardId`) and the boards base path
is available via `useBoardsBasePath`.

## Goals / Non-Goals

**Goals:**
- One menu entry, clipboard write, absolute URL, works everywhere the
  item menu renders.

**Non-Goals:**
- No server-side short links or redirects.
- No copy button in the drawer header (the drawer renders the item
  menu already).

## Decisions

- **URL construction**: `window.location.origin` +
  `useBoardsBasePath()` + `/{item.boardId}?item={item.id}` — built in
  `ItemMenu` so every surface (including my-items, where the open
  board differs from the item's board) links to the item's own board.
- **Clipboard**: `navigator.clipboard.writeText` with a fallback to a
  temporary textarea + `execCommand('copy')` for non-secure contexts;
  failures surface nothing beyond the missing confirmation.
- **Feedback**: the entry's label switches to "Link copied" for ~2s
  via component state; menus close on action, so the state also drives
  nothing else.
- The entry renders above the destructive delete entry and outside the
  `readonly` guard.

## Risks / Trade-offs

- Clipboard access needs a secure context; the fallback covers plain
  HTTP dev setups.

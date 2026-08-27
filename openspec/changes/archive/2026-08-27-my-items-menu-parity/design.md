# Design

## Context

`ItemMenu` (`components/ItemMenu.tsx`) is already the single item menu
for the kanban card, the board table row, and both right-click menus. It
needs three things the my-items listing does not have: `columns` for the
Move-to-column submenu, a `readonly` flag derived from the board's access
level, and a `BoardActions` object whose mutations are bound to a board
id. `MyBoardItem` carries only `{ item, boardId, boardName, columnTitle }`.

`MyItemsList` renders one `BoardGroupTable` per board, so "the board this
row belongs to" is already a per-component fact, not a per-row one.

## Goals / Non-Goals

**Goals:**

- One menu component for item actions on every surface; no second list of
  entries to keep in sync.
- Status, due date, assignee, and delete work from the my-items table for
  boards where the user has write access.
- The listing stays correct after an action, including when the item
  drops out of it.

**Non-Goals:**

- Changing the `/my-items` response or any other API.
- Drag and drop, inline title editing, or item creation in the my-items
  table.
- Board-level actions (archive, share, settings) in this table — they
  stay on the board page.
- Giving the boards list's Favorites/All row menus item-style actions;
  those rows are boards, not items.

## Decisions

**Resolve the board per group, don't extend the API.** `BoardGroupTable`
calls the existing `useBoardQuery(group.boardId)`, which is cached under
`queryKeys.board(boardId)` and shared with the board page. That is one
extra GET per distinct board in the listing (groups are few — a user's
items rarely span more than a handful of boards), and it needs no
backend, wire-format, or database change.

The alternative, adding `columns` and `access` to every `MyBoardItem`,
repeats the board's columns once per item and changes a shipped response
shape for a purely frontend need; grouping the response by board instead
would be a breaking change to `listMyItems` and its actions/tests. If the
per-group fetches ever show up as a problem, that is the follow-up.

**Narrow the actions type instead of faking a `BoardActions`.**
`ItemMenu` only calls `openItem`, `moveItem`, `setItemDueDate`,
`setAssignees`, and `deleteItem`. Those five move into an `ItemActions`
interface exported from `ItemMenu.tsx`, and `BoardActions` in
`BoardView.tsx` extends it. `ItemMenu` takes `ItemActions`, so the
my-items table supplies exactly what it can honor rather than stubbing
column mutations it must never run. This also reverses today's type-only
import from `ItemMenu` to `BoardView`, so the menu no longer refers back
to the view that renders it.

**"Open board" is an extra entry, not a second menu.** `ItemMenu` gains
an optional `extraItems?: ReactNode` rendered directly after Open
details; the my-items table passes its Open-board entry there. The
alternative — keeping `MyItemMenu` and duplicating the submenus — is the
duplication this change exists to remove.

Open details keeps `ItemMenu`'s wording on both surfaces; the my-items
menu's current "Open item" label disappears, and its test moves with it.

**Actions are built per group from `boardsApi`, and invalidate both
sides.** `BoardGroupTable` builds its `ItemActions` from `boardsApi`
bound to `group.boardId`: `moveItem`, `updateItem` (due date, assignees),
and `deleteItem`, each followed by `invalidateBoard(client, boardId)`
plus an invalidation of the my-items key. `queries.ts` gains
`queryKeys.myItems` (the `['boards', 'my-items']` key `MyItemsList`
already uses inline) and an `invalidateMyItems` helper, because
`invalidateBoard` invalidates `queryKeys.boards` with `exact: true` and
therefore does not reach it.

These are plain awaited mutations, not the optimistic `useMoveItem` /
`useRenameItem` hooks: those write into `queryKeys.items(boardId)`, a
cache the my-items listing does not read, so optimism there would buy
nothing while the row's own data lives elsewhere. Failures surface in the
listing's existing error slot, driven by local state the way `BoardPage`
does it.

**`openItem` navigates, as it already does here.** The my-items version
of `openItem` is today's navigate to the board path with `?item=<id>`,
so Open details from this table lands on the board with the drawer open —
the same destination as clicking the row.

**Readonly follows the board, per group.** `readonly` is
`!levelIncludes(board.access, 'write') || !!board.archivedAt ||
!!item.externalManager`, matching `BoardPage`. While the board query is
still loading, or if it fails, the group renders the menu with
`readonly`, so the navigation entries work immediately and the submenus
appear once the board resolves. (Archived boards are already excluded
from `listMyItems`; the check is kept so the rule lives in one shape.)

**The quick-assign pool is the group's own assignees.** On a board,
`assigneePool` is every assignee on the loaded items. Here the listing
holds only the current user's items, so the pool is the assignees seen on
that group's rows; `ItemMenu` adds "Me" itself. The submenu can therefore
offer fewer people than the same menu on the board page. Fetching
`useItemsQuery(boardId)` per group to close that gap doubles the requests
for a shortcut list; full assignment stays available in the item drawer,
one click away via Open details.

**Status renders as `StatusBadge`.** With the board resolved, the status
cell shows the dot and color the board table uses, looked up by
`item.columnId`. Before the board loads, it falls back to a badge built
from the entry's `columnTitle`, which is what the row shows today.

## Risks / Trade-offs

- Acting on a row can remove it from the listing (unassigning yourself)
  or change its group's status column, so the table must refetch, not
  just look right optimistically → the my-items invalidation above; the
  Playwright check covers the unassign case explicitly.
- One extra board GET per group on a page that previously made a single
  request; cached and shared with the board page, and bounded by the
  number of boards the user has items on.
- Menu contents now depend on an async fetch, so the first opening of a
  menu right after page load may show only the navigation entries →
  submenus appear once resolved; no entry ever changes meaning, only
  appears.
- Delete item is now reachable from a listing where the item's board is
  not on screen. It is the same guarded action as on the board page (and
  a soft delete, restorable from the board's archived items), so the risk
  is misclicking in a denser table rather than data loss.

## Migration Plan

UI-only; no data, API, or config migration. Reverting the commit restores
the two-entry my-items menu.

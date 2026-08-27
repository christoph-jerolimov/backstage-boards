## Context

`BoardListPage` builds its Favorites/All rows by hand (`Flex` with a
border) and `MyItemsList` does the same per board group. The board's
`TableView` already has the target shape: a BUI `TableRoot` whose last
column holds a three-dot `MenuTrigger`, plus `ItemContextMenu` — a
controlled `MenuTrigger` anchored to an invisible 1×1 fixed-position
button at the pointer — for right-click. See proposal.md for why.

## Goals / Non-Goals

**Goals:**

- One anchoring implementation for the right-click menu, shared by the
  board table, the boards list, and my items.
- Board and my-items listings render as BUI tables with a trailing
  Actions column, keeping today's click-to-open behaviour.

**Non-Goals:**

- Sorting, filtering, or pagination of the boards list.
- Board-level destructive actions (archive, duplicate, settings, share)
  in the row menu — they stay on the board page.
- Any change to the `/boards` or `/my-items` API responses.

## Decisions

**Extract the pointer anchor, don't copy it.** A new `RowMenu.tsx`
exports `useRowContextMenu<T>()` (state plus an `open(row, event)` that
calls `preventDefault`), `RowContextMenu` (the invisible anchored
`MenuTrigger`, rendering its children for the captured row), and
`RowActionsMenu` (the three-dot `ButtonIcon` + `MenuTrigger` for a row's actions cell).
`ItemContextMenu` is rebuilt on `RowContextMenu` so the board table,
the boards list, and my items share one copy of the fixed-position
trick. The alternative — pasting the anchor into two more components —
leaves three copies of the same hack to keep in sync.

**One `BoardsTable` for both tabs.** Favorites and All differ only in
their rows and empty text, so both render the same component: columns
Favorite (star toggle), Name (row header), Entities, Access, Actions;
`onRowAction` navigates to the board. When a tab has no boards the
existing empty text renders instead of an empty table.

**`BoardMenu` offers what the list page can already do:** open the
board, and add/remove favorite. Reusing the board page's menu would
mean fetching `BoardWithContext` (columns, watching) and mounting its
confirm dialogs per row; the list only holds `BoardListEntry`, and
per-row fetches for a listing are not worth it.

**My items keeps its board grouping**, with each group's rows becoming a
`TableRoot`: Item (row header), Status, Due, Tags, Actions. Its menu
(`MyItemMenu`) offers Open item and Open board — the board table's
`ItemMenu` needs the board's columns and the `BoardActions` mutations,
neither of which `listMyItems` returns.

## Risks / Trade-offs

- Right-click could also fire `onRowAction` and navigate away →
  `preventDefault` in the handler, as `TableView` already does; verify
  by right-clicking a row and checking the route is unchanged.
- The star button sits inside a row that navigates on click, so a
  toggle could open the board → the star cell's press handler must not
  bubble into the row action; verify toggling stays on the list.
- Two menu components (`BoardMenu`, `MyItemMenu`) with two entries each
  is thin, but shared anchoring keeps the duplication to the entries
  themselves.

## Migration Plan

UI-only; no data or API migration. Reverting the commit restores the
previous rendering.

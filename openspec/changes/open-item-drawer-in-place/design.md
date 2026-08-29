## Context

See proposal.md for motivation. Current mechanics that shape the design:

- `ItemDrawer` (`plugins/boards/src/components/ItemDrawer.tsx`) is fully
  prop-controlled: `{ board, item, canWrite, tagSuggestions?, onClose,
  onChanged }`. It has no URL knowledge, no board-scoped React context,
  and renders as a fixed-position overlay (zIndex 900/901), so it works
  wherever it is mounted. All its mutations call `boardsApiRef` with
  `board.id` directly.
- Drawer↔URL sync (`?item=` search param via `useOpenItemParam` in
  `useBoardActions.ts`) exists only on the board page (`BoardPage.tsx`)
  and the embedded catalog-entity variant. Notification deep links use
  `/boards/<boardId>?item=<itemId>` and must keep working.
- `MyItemsPage.tsx` (`MyItemsList`, used by both the sub-page and the
  boards-page tab) already fetches full boards via `useBoardsQueries`
  (shared query key `queryKeys.board(id)`) and already derives per-row
  `canWrite` and runs mutations with cache invalidation
  (`invalidateBoard` + `invalidateMyItems`).
- `AssignedItemsWidget.tsx` fetches only `listMyItems` snapshots
  (`MyBoardItem`: item + boardId/boardName/columnTitle) — no boards. Its
  only extra context is `BoardsWidgetProvider` (the shared
  `QueryClientProvider`).
- Both hosts currently call `navigate(`${basePath}/${boardId}?item=${id}`)`
  on item activation.

## Goals / Non-Goals

**Goals:**

- One shared drawer-host component both surfaces reuse, so drawer
  behavior cannot drift between homepage, my-items page, and tab.
- The drawer shows fresh item data and keeps working (stays open) even
  when an edit removes the row from the hosting list.
- No change to `ItemDrawer` itself, the board page, or the backend.

**Non-Goals:**

- No deep links to an in-place drawer (no new URL params on the homepage
  or my-items page); `/boards/<boardId>?item=<itemId>` remains the only
  deep-link form.
- No browser-back-closes-drawer behavior (matches: drawer is closed by
  backdrop click, close button, and Escape, all already in `ItemDrawer`).
- No changes to the board-name / "open board" navigation entries.

## Decisions

1. **New shared host component `ItemDrawerHost`** (new file,
   `plugins/boards/src/components/ItemDrawerHost.tsx`) with props
   `{ boardId, itemId, fallbackItem, onClose }`. It:
   - resolves the board through the existing shared query key
     (`useBoardsQueries([boardId])`), so on my-items it hits the cache
     and on the homepage it fetches lazily only once a drawer is opened;
   - resolves the fresh item via `useItemsQuery(boardId)` and falls back
     to the `MyBoardItem.item` snapshot until it arrives, so edits made
     in the drawer re-render it with server state;
   - derives `canWrite` exactly as `MyItemsPage` does today
     (`levelIncludes(board.access, 'write') && !board.archivedAt`);
   - derives `tagSuggestions` as the union of tags across the board's
     fresh items (equivalent to the board page's `filter.allTags`);
   - passes `onChanged` = `invalidateBoard(queryClient, boardId)` +
     `invalidateMyItems(queryClient)` so both the board caches and the
     hosting list refresh.
   *Alternative considered:* wiring `ItemDrawer` directly into each host
   — rejected because the board/item/canWrite/invalidation plumbing
   would be duplicated in three call sites (widget, page, tab).

2. **Selection is plain component state, not URL state.** Each host
   keeps `{ boardId, itemId, fallbackItem } | undefined` in `useState`;
   activation sets it, `onClose` clears it. *Alternative considered:*
   `?board=<id>&item=<id>` search params. Rejected: the homepage URL is
   not owned by this plugin (param collisions with other widgets), it
   would create a second deep-link format to support forever, and the
   specs don't require linkability of the in-place drawer.

3. **Host state holds ids + snapshot, not the list entry.** The drawer
   must survive its row disappearing (e.g. the user unassigns
   themselves): ids keep the queries alive, and the fresh items query
   still contains the item even when `listMyItems` no longer does.

4. **Failure fallback: navigate.** If the board query for an opened
   drawer fails (board deleted, access revoked), the host falls back to
   the current behavior — `navigate(`${basePath}/${boardId}?item=${itemId}`)`
   — instead of rendering a broken drawer; the board page owns error
   rendering. While the board is still loading, the host renders nothing
   (my-items has it cached; the homepage fetch is one small request).

5. **Hosts change only their activation handlers.**
   - `AssignedItemsWidget.tsx`: `openItem` sets host state instead of
     `navigate`; `openBoard` unchanged.
   - `MyItemsPage.tsx` (`MyItemsList`): `TableRoot onRowAction` and
     `actionsOf(boardId).openItem` set host state instead of `navigate`;
     board heading/column links and "open board" menu entry unchanged.
   Because `MyItemsList` is shared, the boards-page "My items" tab gets
   the behavior for free.

## Risks / Trade-offs

- [Drawer overlay on a crowded homepage: another widget or the app shell
  could render above zIndex 901] → verify visually via the existing
  home-widgets e2e test; the drawer already renders outside `/boards/*`
  today (catalog entity tab), so the pattern is proven.
- [Stale snapshot flash: drawer opens with `listMyItems` data, then
  re-renders with fresh item] → acceptable; same fields, sub-second, and
  strictly better than navigating away.
- [Losing the URL as drawer state means no share/refresh restore for the
  in-place drawer] → deliberate (Decision 2); users who want a shareable
  link use the board entry, and notifications keep the board deep link.
- [Two extra queries (board + items) when opening from the homepage] →
  scoped to explicit user action, shared query keys mean the follow-up
  board visit is pre-warmed.

## Migration Plan

Pure frontend change inside the `boards` plugin; ship with the next
plugin release. Rollback = revert the commit. Existing
`/boards/<boardId>?item=<itemId>` links are untouched.

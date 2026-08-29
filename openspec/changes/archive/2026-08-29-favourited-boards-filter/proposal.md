# Favourited Boards Filter

## Why

The boards list page offers a filter bar (search, entity, created-by) on the "All" tab only. Users with many favourited boards have no way to narrow the "Favorites" tab — they must switch to "All" and lose the favourites scoping. The backend listing API already combines `favoritesOnly` with every other filter, so the capability exists but is not surfaced.

## What Changes

- The "Favorites" tab of the board list gains the same filter bar as the "All" tab: search, entity dropdown, and created-by dropdown, combined AND with the favourites scoping.
- Each tab owns its own filter state: filters applied on one tab do not affect the other, and switching tabs does not clear them. (This replaces the current "Favorites tab is unfiltered" guarantee.)
- The "Favorites" tab label keeps counting all of the user's favourited boards, independent of active filters — the same stability the "All" tab label already guarantees. The filter-options endpoint additionally returns the caller's favourites count to support this.
- The filter bar's "X of Y boards" match count uses the favourites total as its denominator on the Favorites tab.
- The Favorites tab distinguishes "no favourites yet" from "no favourites match your filters" in its empty state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/board-management`: The "Board list view" and "Filter the board list by search, entity, and creator" requirements change — the filter bar is offered on both tabs instead of the "All" tab only, and the "Favorites tab is unfiltered" scenario is replaced by per-tab filter independence. The "Board filter options are scoped to the caller's boards" requirement gains the caller's favourites count in the endpoint response.

## Impact

- `plugins/boards/src/components/BoardListPage.tsx` — render the filter bar on the Favorites tab, per-tab filter instances, empty states, tab label count.
- `plugins/boards/src/components/BoardsFilterBar.tsx` — accept the denominator for the match count instead of always using the readable-boards total.
- `plugins/boards-common/src/types.ts` — `BoardFilterOptions` gains a `favorites` count.
- `plugins/boards-backend/src/service/BoardsService.ts` — `listFilterOptions` computes the caller's favourites count (no listing changes: `favoritesOnly` already ANDs with the other filters).
- Tests: `BoardListPage.test.tsx`, `BoardsService.test.ts`, `router.test.ts`.
- No migrations, no breaking API changes (`favorites` is an additive response field).

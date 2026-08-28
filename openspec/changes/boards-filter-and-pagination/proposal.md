## Why

The Boards page loads every board the user can read in one request and
renders all of them in one table per tab. There is nothing to narrow the
list with — no search, no way to jump to "the boards for `payments`" or
"the boards Anna set up" — and the only ordering is by name. On an
instance with a few hundred boards the "All" tab is a wall of rows and a
response that grows without bound. The board page and the my-items
listing both have a filter bar; the board list is the one listing in the
plugin that does not.

Adding a filter bar naively would leak information the boards plugin is
otherwise careful about. A "Created by" dropdown fed from the catalog
would list every user in the organisation, and one fed from *all* boards
would tell the viewer who owns boards they are not allowed to see. The
whole point of the filter is narrower than that: **of the boards I can
see, which ones do I want to look at right now.** Its options therefore
have to be derived from the caller's own accessible board set, on the
server, next to the access rules that decide that set.

Pagination has the same constraint from the other side. Today the access
filter runs in JavaScript *after* the query (one permission query per
board, an N+1), so a `LIMIT` on that query would cut the page before the
filter ran and hand back short or wrong pages. Paginating correctly means
expressing board visibility in SQL.

## What Changes

- **The "All" tab gets a filter bar**, in the shape `ItemFilterBar`
  already established: a 240px "Search" field over the board name, an
  "Entity" dropdown, a "Created by" dropdown, the match count, and a
  "Clear filters" action. Filters combine with AND. Creator options are
  labelled through the catalog exactly as the assignee filter labels its
  own — resolved display name, the ref itself as the tooltip.

- **Both dropdowns are fed by a new `GET /boards/facets` endpoint** that
  returns the distinct entity refs and the distinct creators *of the
  boards the caller can read*, and nothing else. No catalog-wide user
  list, no creator of a board the caller cannot see. The options do not
  shrink as the user picks filters, so a selection can always be changed
  or widened.

- **`GET /boards` gains `limit`/`offset` pagination** and returns
  `{ boards, total, limit, offset }`. Filtering (`search`, `entityRef`,
  `createdBy`, `favorites`) happens in SQL before the page is cut, so
  `total` counts matches and every page is full. Omitting `limit` returns
  the whole listing exactly as today, so the homepage widgets, the
  catalog entity tab, and the actions all keep working untouched.

- **Unlike the board and my-items filter bars, this one filters on the
  server.** Those two filter a listing the browser already holds; with
  pagination the browser only ever holds one page, so a client-side
  filter could not reach a board that is not already on screen.

- **Board visibility moves into the SQL query.** A single predicate
  expresses what `computeEffectiveLevel` decides — public, logged-in, or
  an explicit grant to the user or one of their groups — so pagination
  and `total` are computed over the right set. The permission rows for
  the returned page are then loaded in one batched query and the exact
  access level is still computed by `computeEffectiveLevel`, which stays
  the single source of truth for the level itself. A test pins the two
  implementations to the same answer over a matrix of visibilities and
  grants.

- **Both tabs paginate.** A pagination footer under each table shows the
  visible range and the match count, offers previous/next, and lets the
  user pick a page size. Only the "All" tab carries the filter bar.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: the board list view is specified with a
  filter bar and pagination; the listing API is specified with
  search/creator filters, `limit`/`offset` paging and a total; and a new
  filter-options endpoint is specified together with the access scoping
  that keeps it from leaking boards, entities, or users the caller
  cannot see.

## Impact

- **`boards-common`**: a `BoardListFilter` type (search, entityRef,
  createdBy, favoritesOnly), a `BoardListResult` type (`boards`, `total`,
  `limit`, `offset`) and a `BoardFilterOptions` type (`total`,
  `entityRefs`, `creators`). Label helpers need nothing new:
  `refDisplayName` and `entityDisplayName` already exist for this.
- **`boards-backend`**: a SQL visibility predicate in `BoardsService`,
  used by `listBoards` (which now filters, orders, pages, and counts in
  SQL and returns a `BoardListResult`) and by a new `listFilterOptions`;
  batched permission loading replaces the per-board `effectiveLevel`
  call; `GET /boards` reads the new query parameters and
  `GET /boards/facets` is added ahead of `/boards/:boardId` in the route
  table.
- **`boards`** (frontend): `BoardsApi.listBoards` returns the result
  object and accepts the filters and paging; a new `listFilterOptions`;
  `queries.ts` gains a paged board-list hook under a `['boards','page']`
  key (`['boards','list']` is the widget's) and a facets hook, and its
  invalidations widen so favoriting and `boards` signals still refresh a
  paged table; `BoardListPage` gains a `BoardsFilterBar` and a
  `TablePagination` footer shared by both tabs, and moves its
  loading/empty handling onto `AsyncList` like the other listings.
- **Reused as-is**: `useProfiles` and `RefLabel` for the creator and
  entity options, `useRowMenu`, `EntityRefList`, `FavoriteButton` and
  `useBoardsSignal` in the table that already uses them.
- **No change** to permissions, archival, or what a user may read: the
  listing returns the same boards it does today, in pages, and the filter
  options are derived from that same set.

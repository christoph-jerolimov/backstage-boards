# Tasks

## 1. Shared types (common)

- [ ] 1.1 Add `BoardListFilter` (`search?`, `entityRef?`, `createdBy?`,
      `favoritesOnly?`), `BoardListResult` (`boards`, `total`, `limit?`,
      `offset?`) and `BoardFilterOptions` (`total`, `entityRefs`,
      `creators`) to `boards-common/src/types.ts`, exported from
      `index.ts`. Verify with
      `yarn workspace @internal/plugin-boards-common tsc`. No new label
      helper: `refDisplayName` and `entityDisplayName` already cover the
      dropdown labels.

## 2. Visibility in SQL (backend)

- [ ] 2.1 Add a private `visibleBoards(principal)` query builder to
      `BoardsService`: non-archived, plus the visibility disjunction
      (public always; logged-in for user principals; `whereExists` over
      `board_permissions` for `principal_ref in (userRef,
      ...ownershipRefs)`) and no predicate at all for service
      principals. Not wired into anything yet.
- [ ] 2.2 Add the parity test: for the matrix of five visibilities ×
      {no grant, direct user grant, group grant} × {user, service,
      anonymous}, assert the ids selected by `visibleBoards` equal the
      ids for which `computeEffectiveLevel` returns a level. This test
      is the guard against the two rules drifting — write it before
      2.3.
- [ ] 2.3 Rebuild `listBoards` on `visibleBoards`: drop the per-board
      `effectiveLevel` call in favour of one
      `whereIn('board_id', pageIds)` load of `board_permissions` feeding
      `computeEffectiveLevel` per row. Verify the existing
      `BoardsService.test.ts` listing cases still pass unchanged and
      that listing a set of boards issues a constant number of queries.

## 3. Filtering, ordering, paging (backend)

- [ ] 3.1 Add `search` (case-insensitive `lower(name) like ?` with `%`,
      `_` and the escape character escaped) and `createdBy` (equality)
      filters to `listBoards`, keeping `entityRef` and `favoritesOnly`
      as they are and combining all of them with AND. Verify with
      service tests: match, no match, whitespace-only search is not a
      filter, a name containing `%` matches literally, and two filters
      combining.
- [ ] 3.2 Order by `name, id` and add `limit`/`offset` paging plus a
      `count(*)` total over the same filtered visible query; return
      `BoardListResult`. Without `limit`, return everything with
      `total = boards.length`. Verify with tests for a second page,
      access applied before the page is cut, total counting matches not
      rows, boards with equal names paging without repeat or skip, and
      the unpaged shape.
- [ ] 3.3 Attach `withCounts` status counts to the returned page only
      (not the whole matching set). Verify counts still appear for a
      paged listing and cost one query.
- [ ] 3.4 Add `listFilterOptions(principal)` returning
      `{ total, entityRefs, creators }` — distinct `board_entities`
      entity refs and distinct `boards.created_by` over the visible
      board ids, sorted, plus the visible board count — ignoring the
      caller's current filters. Verify with tests: options from readable
      boards only, an inaccessible board's entity and creator absent, an
      archived board's contribution gone, and a catalog user who created
      nothing readable absent.

## 4. Routes (backend)

- [ ] 4.1 Read `search`, `createdBy`, `limit` and `offset` in
      `GET /boards`, rejecting non-numeric/negative paging values with
      `InputError` and clamping `limit` to the maximum page size; return
      `{ boards, total, limit, offset }`. Verify with `router.test.ts`
      cases for each parameter, for the rejection cases, and asserting
      that a request without `limit` still returns every board.
- [ ] 4.2 Register `GET /boards/facets` **before** `/boards/:boardId`
      and return `listFilterOptions`. Verify with a router test that the
      endpoint answers (not 404 from the `:boardId` route) and that it
      returns only the calling principal's options.

## 5. Frontend data access

- [ ] 5.1 Change `BoardsApi.listBoards` / `BoardsClient` to take the
      filters and `limit`/`offset` and return `BoardListResult`, and add
      `listFilterOptions()`. Verify with `api.test.ts` cases asserting
      the built query string for each option combination and the parsed
      result shape.
- [ ] 5.2 In `queries.ts`, add `useBoardsPageQuery(params)` under
      `['boards', 'page', params]` (not `['boards','list']`, which
      `useBoardListQuery` owns) with `placeholderData: keepPreviousData`,
      and `useBoardFilterOptionsQuery()`; keep `useBoardListQuery` and
      `useBoardsByEntityQuery` returning a plain array via react-query
      `select` so the widgets and the entity tab need no change. Verify
      with `queries.test.tsx`: distinct cache entries per params, and
      the widget hook still yielding an array.
- [ ] 5.3 Widen the invalidations that today use
      `{ queryKey: queryKeys.boards, exact: true }` — in
      `invalidateBoard` and in the `useBoardsSignal` handler on the list
      page — to also invalidate the `['boards', 'page']` prefix, without
      pulling `queryKeys.myItems` or the per-board keys in. Verify with a
      `queries.test.tsx` case that a paged listing is invalidated and
      my-items is not.

## 6. Filter bar and pagination (frontend)

- [ ] 6.1 Add `TablePagination` (range summary, previous/next disabled
      at the bounds, page-size Select of 10/25/50 defaulting to 25, in
      the 160px wrapper my-items uses for its group-by select), built
      from BUI primitives unless `@backstage/ui` exports a pagination
      component. Verify with a component test covering both bounds and a
      page-size change.
- [ ] 6.2 Add `BoardsFilterBar` in `ItemFilterBar`'s shape: 240px
      `SearchField` debounced 250ms before it reaches the query, an
      "Entity" and a "Created by" `MenuTrigger` menu each with an
      "All entities" / "Anyone" entry and a `✓` on the selected one, the
      growing match count and the right-pinned "Clear filters". Options
      come from `useBoardFilterOptionsQuery`, labelled through
      `useProfiles` with `refDisplayName` as the fallback and wrapped in
      `RefLabel`, sorted by label. Verify with tests: options come only
      from the facets response and never from a catalog listing, the
      debounce, single-selection replacing rather than adding, and clear
      resetting everything.
- [ ] 6.3 Wire `BoardListPage`: per-tab paged queries (Favorites with
      `favoritesOnly`, All with the filters), the filter bar on the All
      tab only, `TablePagination` under both tables, page reset on any
      filter or page-size change, tab labels from the favorites total
      and from `facets.total` for All. Verify with `BoardListPage.test.tsx`
      that the All label does not change while filtering and that paging
      keeps the previous rows on screen.
- [ ] 6.4 Move the page's loading/error/empty handling onto `AsyncList`
      and split the two empty reasons: "No boards are accessible to you
      yet. Create one!" when `facets.total === 0`, "No boards match your
      filters." with a clear action when a filter is active. Verify both
      with `BoardListPage` tests.

## 7. Verification

- [ ] 7.1 `yarn tsc`, `yarn lint:all`, `yarn test`.
- [ ] 7.2 Smoke the Boards page against the dev app with more boards
      than one page: search, both dropdowns, combined filters, clear,
      paging in both tabs, page size, favoriting from a page other than
      the first, and a second user confirming their dropdowns list only
      their own boards' entities and creators.

# Tasks

## 1. Per-status counts (common + backend)

- [ ] 1.1 Add `BoardStatusCount` to `boards-common/src/types.ts` and the
      optional `statusCounts?: BoardStatusCount[]` field on
      `BoardListEntry`; export it from `index.ts`. Verify with
      `yarn workspace @internal/plugin-boards-common tsc` and the
      existing `types.test.ts` still passing.
- [ ] 1.2 Extend `BoardsService.listBoards` with `withCounts`: after the
      existing access/favorites filtering, load `board_columns` for the
      surviving board ids ordered by position and a
      `count(*) group by column_id` over non-archived `items`, and attach
      `statusCounts` with zero-filled columns. Verify with service tests
      covering counts present, zero-count column included, archived item
      excluded, and an unreadable board contributing nothing.
- [ ] 1.3 Read `?counts=true` in the `GET /boards` route and pass it
      through. Verify with router tests asserting counts appear with the
      flag, and that the response without the flag is byte-identical to
      the current one (no `statusCounts` key).

## 2. Frontend data access

- [ ] 2.1 Add `withCounts` to `BoardsApi.listBoards` / `BoardsClient`
      (sets `counts=true` on the query string). Verify with an `api.test.ts`
      case asserting the requested URL for each option combination.
- [ ] 2.2 Add `useBoardListQuery({ favoritesOnly, withCounts })` to
      `queries.ts` under the `['boards', 'list', options]` key. Verify
      with a `queries.test.tsx` case that the four setting combinations
      produce four distinct cache entries.
- [ ] 2.3 Add `filterDueEntries(entries, now)` and
      `groupMyItems(entries, mode)` to `components/grouping.ts`, returning
      `{ key, label, entries }[]` in the spec's order. Verify with unit
      tests for: overdue + today kept and future/undated dropped;
      board/status/dueDate ordering; undated group last; same status from
      two boards grouped together.

## 3. Assigned items widget

- [ ] 3.1 Add `components/AssignedItemsWidget.tsx` — `Content` reading
      `scope`/`groupBy` props with defaults `all`/`board`, the shared
      `['boards','my-items']` query, `useSignal('boards')` refetch, and a
      `ContextProvider` supplying `boardsQueryClient`. Verify with
      component tests: renders with **no props** using the defaults;
      loading, error, "nothing assigned", and "nothing due" states.
- [ ] 3.2 Render the grouped list — group label with count (board labels
      link to the board), rows with title, `StatusBadge`, `DueDateBadge`,
      item click navigating to `<base>/<boardId>?item=<itemId>`, and an
      internally scrolling body. Verify with tests asserting the rendered
      grouping for each `groupBy` value and the navigation target of an
      item click.

## 4. Boards widget

- [ ] 4.1 Add `components/BoardsWidget.tsx` — `Content` reading
      `scope`/`showCounts` props with defaults `favorites`/`false`, using
      `useBoardListQuery`, `useSignal('boards')` refetch, and the same
      `ContextProvider`. Verify with component tests: renders with no
      props using the defaults; loading and error states; the
      favorites-empty message differs from the all-empty message.
- [ ] 4.2 Render board rows — name linking to `<base>/<boardId>`, and
      when `showCounts` is on a chip per status built from `statusCounts`
      using `ColumnDot`/column color, zero counts included. Verify with
      tests asserting counts render (including a zero) when on, no counts
      when off, and that `withCounts` is only requested when the setting
      is on.

## 5. Extensions and app wiring

- [ ] 5.1 Add `@backstage/plugin-home-react` to `plugins/boards/package.json`
      and register both `HomePageWidgetBlueprint` extensions in
      `plugin.tsx` (`BoardsAssignedItems`, `BoardsList`) with titles,
      descriptions, layout hints, and the RJSF `settings.schema` /
      `uiSchema` from design.md §1. Verify with a `plugin.test.tsx` case
      asserting both extension ids are present on the plugin and carry a
      settings schema.
- [ ] 5.2 Add both widgets to `app-config.yaml`'s `page:home`
      `defaultConfig`. Verify by starting the app and seeing both cards on
      `/home`, each with a working settings dialog offering its two
      settings.

## 6. Verification

- [ ] 6.1 Run `yarn prettier:check`, `yarn lint:all`, `yarn tsc:full`, and
      `yarn test:all`; all pass with the new tests included.
- [ ] 6.2 Add a Playwright case under `plugins/boards/e2e-tests` that
      opens `/home`, asserts both cards render with seeded data, changes
      the Boards card's scope setting, and asserts the card's content
      changes and survives a reload.

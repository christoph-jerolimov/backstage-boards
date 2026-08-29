# Favourited Boards Filter — Tasks

## 1. Backend: favourites count in filter options

- [ ] 1.1 Add `favorites: number` to `BoardFilterOptions` in `plugins/boards-common/src/types.ts` and update its doc comment; verify with `yarn tsc` (workspace type check passes once consumers are updated in 1.2).
- [ ] 1.2 Extend `BoardsService.listFilterOptions` to count the caller's favorited boards among the readable, non-archived ids (0 for non-user principals and for the empty-ids early return); verify with a new `BoardsService.test.ts` case covering the per-caller counts scenario (two favourites → 2, other user → 0, archived board excluded) via `yarn workspace @internal/plugin-boards-backend test`.
- [ ] 1.3 Confirm the router's `/filter-options` response carries the new field; extend the existing `router.test.ts` filter-options expectation and verify the backend test suite passes.

## 2. Frontend: filter bar on the Favorites tab

- [ ] 2.1 Add a `total` denominator prop to `BoardsFilterBar` (defaulting to `filter.options?.total`) and use it in the "X of Y boards" text; verify existing `BoardListPage.test.tsx` still passes via `yarn workspace @internal/plugin-boards test`.
- [ ] 2.2 In `BoardListPage`, give the Favorites tab its own `useBoardFilter()` instance, build its page query as `{ ...filter, favoritesOnly: true }`, and render `BoardsFilterBar` in the Favorites panel with `total={options.favorites}`; verify by a test that typing a search on the Favorites tab requests the listing with both `favorites` and `search` set.
- [ ] 2.3 Switch the Favorites tab label to count from `filter.options?.favorites` and invalidate `queryKeys.filterOptions` in `toggleFavorite`; verify by tests that the label stays constant while favourites filters are active and updates after a star toggle.
- [ ] 2.4 Split the Favorites empty state: "No favorite boards match your filters." when that tab's filter is active, the existing "No favorite boards yet…" message otherwise; verify by a test rendering each state.
- [ ] 2.5 Add a test that filters are per-tab: set a filter on one tab, switch tabs, and assert the other tab's request carries no such filter and the first tab's filter survives the round trip.

## 3. Verification

- [ ] 3.1 Run the full checks a contributor runs locally (`yarn tsc`, `yarn lint`, and the boards + boards-backend test suites) and confirm all pass.
- [ ] 3.2 Walk the modified spec scenarios ("Favorites tab filters within favorites", "No favorite matches", "Tab labels unaffected by filters", "Tabs filter independently", "Favorites count is per-caller") against the implementation/tests and confirm each is covered.

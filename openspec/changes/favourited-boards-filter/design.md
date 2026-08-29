# Favourited Boards Filter — Design

## Context

See proposal.md for motivation. Current state that shapes the approach:

- `BoardListPage` renders three tabs. The "All" tab builds its request from `useBoardFilter()` and renders `BoardsFilterBar`; the "Favorites" tab requests a constant `{ favoritesOnly: true }` filter and renders no bar.
- The listing backend already ANDs `favoritesOnly` with `search`, `entityRef`, and `createdBy` (`BoardsService.listBoards`), so no listing API work is needed.
- `BoardsFilterBar` hard-codes its match-count denominator to `options.total` (all readable boards) and its dropdowns come from the filter-options endpoint.
- The Favorites tab label currently shows the favorites listing's `total`; once that listing is filterable, this number would shrink with filters, unlike the "All" label which deliberately counts the unfiltered set from `BoardFilterOptions.total`.
- Favorites are per-user; `listFilterOptions` takes a `BoardsPrincipal`, and non-user principals cannot have favorites.

## Goals / Non-Goals

**Goals:**

- Filter bar on the Favorites tab, composing with the favourites scoping server-side.
- Per-tab filter state; stable, filter-independent tab labels on both tabs.
- Correct match-count denominator and empty states per tab.

**Non-Goals:**

- No changes to the listing API, pagination, or the item filter bar.
- No filter bar on other board listings (entity tab, home widgets, My items).
- No persistence of filter state across page reloads.

## Decisions

**1. Compose `favoritesOnly` in the frontend request; no backend listing change.**
The Favorites tab builds its page query as `{ ...filter, favoritesOnly: true }`. The backend already applies favourites as one more AND clause. Alternative — a dedicated favourites-listing endpoint — rejected: pure duplication.

**2. Two independent `useBoardFilter()` instances, one per tab.**
Each tab calls `useBoardFilter()` itself, so search/dropdown state, debounce, and "Clear filters" are per-tab, and tab switching preserves both. Alternative — one shared filter handle for both tabs — rejected: a filter set on "All" would silently narrow "Favorites" (contradicting the kept "Favorites tab is unfiltered" scenario), and clearing on one tab would surprise on the other. The two instances share the single cached filter-options query, so no extra requests result.

**3. Favourites count comes from the filter-options endpoint.**
`BoardFilterOptions` gains `favorites: number` — the count of the caller's favorited, readable, non-archived boards (0 for non-user principals, matching how `listBoards` treats `favoritesOnly` for them). The Favorites tab label reads it instead of the listing's now-filterable `total`, mirroring how the "All" label reads `options.total`. Alternatives rejected:
- Label from the filtered listing total: label jumps as the user types, and the spec pins labels as filter-independent.
- A second unfiltered favourites listing query just for the count: an extra request per page view for one number the options query can carry.
The new field is additive and optional consumers ignore it — no API break.

**4. `BoardsFilterBar` takes the denominator as a prop.**
New `total` prop for the "X of Y boards" text: the All tab passes `options.total` (or the bar keeps that as its default), the Favorites tab passes `options.favorites`. Alternative — branching inside the bar on a mode flag — rejected: the bar shouldn't know about tabs.

**5. Cache invalidation on favorite toggle.**
`toggleFavorite` currently refetches both page queries; it must additionally invalidate `queryKeys.filterOptions` so the Favorites tab label moves with the star. The signals handler already invalidates filter options.

**6. Empty states.**
The Favorites panel mirrors the All panel's split: with active filters, "No favorite boards match your filters." (the bar above holds the clear action); without, the existing "No favorite boards yet — star a board in the All tab." message.

## Risks / Trade-offs

- [Filter options query gains one COUNT] → One indexed `whereIn`/join count over the caller's favorites; negligible next to the existing distinct queries.
- [Per-tab filters may surprise users expecting a shared search] → Mitigated by each tab visibly showing its own bar state; the spec pins the behavior so it stays deliberate.
- [Both tabs mount their page queries on load (already the case today)] → Unchanged by this design; the favorites query just gains filter keys.

## Migration Plan

Deploy backend and frontend together as usual for this repo (single plugin set). `favorites` is an additive response field: an older frontend ignores it; a newer frontend against an older backend would show 0 in the Favorites label — not applicable here since both ship from one repo. No DB migrations. Rollback is a revert.

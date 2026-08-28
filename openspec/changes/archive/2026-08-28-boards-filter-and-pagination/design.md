## Context

`BoardsService.listBoards` selects every non-archived board ordered by
name, then loops the rows in JavaScript: for each one it calls
`effectiveLevel`, which queries `board_permissions` and runs
`computeEffectiveLevel` (`service/access.ts`), to decide whether the
caller may see it and at what level. Favorites and counts are applied to
whatever survives. The router hands the array back as `{ boards }`;
`BoardListPage` fetches it once with `useBoardsQuery`, derives the
Favorites tab client-side, and renders both tabs with the same
`BoardsTable` (`useRowMenu`, `EntityRefList`, `FavoriteButton`).

Three consequences shape this change. The access decision lives *after*
the query, so a `LIMIT` would page the wrong set. The permission lookup
is an N+1 over the whole board table. And the page has no filter inputs
at all, while `ItemFilterBar` — shared by the board page and the my-items
listing — already fixes what one looks like here: a 240px `SearchField`,
tertiary `MenuTrigger` buttons carrying `✓`-marked options, a match count
that takes the free space, and a right-pinned "Clear filters". Its
assignee filter also settles how a `user:` ref is labelled in a menu:
`useProfiles` batch-resolves display names from the catalog,
`refDisplayName` is the fallback before the catalog answers, and
`RefLabel` puts the ref itself in the `title`. See proposal.md for why
this bar's options cannot come from the catalog directly.

## Goals / Non-Goals

**Goals:**

- Search, entity, and creator filters on the "All" tab, evaluated on the
  server so they agree with pagination.
- Filter dropdown options derived from the caller's readable boards
  only — never the catalog's user list, never a board the caller cannot
  read.
- `GET /boards` pages with `limit`/`offset` and reports a `total`, with
  the unpaged response unchanged for existing callers.
- One place that decides board visibility, with the SQL predicate and
  `computeEffectiveLevel` pinned to each other by a test.
- A bar that reads as the same component family as `ItemFilterBar`, even
  though it cannot share its implementation.

**Non-Goals:**

- Filtering or paging the Favorites tab's *contents* by anything but
  favorites (it paginates, but carries no filter bar).
- Sorting controls, or any order other than name.
- Filter state in the URL (shareable filtered links) — worth doing, but
  it is a separate change with its own routing questions.
- Full-text search over item titles, descriptions, or comments; the
  search field matches the board name.
- A grouping control on the board list, as my-items has.
- Cursor/keyset pagination. Offset paging over a name-ordered list is
  what the page's controls need, and the listing is not large enough for
  deep-offset cost to matter.
- Any change to `/my-items`, the board page, or the entity tab.

## Decisions

**Visibility becomes a SQL predicate; the level stays in
`computeEffectiveLevel`.** A private `visibleBoards(principal)` returns a
knex query over `boards` with `archived_at is null` and a disjunction
mirroring `access.ts`: public visibilities always; logged-in visibilities
when the principal is a user; plus `whereExists` over `board_permissions`
for `principal_ref in (userRef, ...ownershipRefs)`. Service principals
get no predicate at all (they already act as admin). Every
listing-shaped query — the page, the `count(*)`, and the facets — is
built from this one builder.

The predicate answers *whether*, not *which level*. The level is still
`computeEffectiveLevel`, now fed by one batched
`whereIn('board_id', pageIds)` query instead of `effectiveLevel` per
board — so the N+1 goes away as a side effect and the level rules keep
exactly one implementation.

Two implementations of "may I see this board" is the real risk here, and
the mitigation is a test rather than a comment: over the matrix of five
visibilities × {no grant, direct user grant, group grant} × {user,
service, anonymous} principals, the set returned by `listBoards` must
equal the set for which `computeEffectiveLevel` returns a level. Anything
that drifts fails that test.

*Alternative rejected:* keep filtering in JavaScript and paginate the
filtered array in memory. It keeps one implementation, but every page
request still reads and permission-checks every board — the cost the
pagination is supposed to remove.

**Filters are SQL, and all of them are AND.** `search` matches the board
name case-insensitively via `whereRaw('lower(name) like ?')` with `%`,
`_`, and the escape character escaped in the input (knex's `whereILike`
is not portable to the SQLite used in tests and in the dev app).
`entityRef` reuses the existing `whereExists` over `board_entities`.
`createdBy` is an equality on `boards.created_by`. `favorites` keeps
working as it does today. An empty or whitespace-only search is not a
filter.

**Ordering gets a tiebreaker.** `order by name, id`. Without the second
key, two boards with the same name can swap places between two page
requests and one of them is then shown twice or not at all.

**`listBoards` returns `{ boards, total, limit, offset }`.** `total` is a
`count(*)` over the same filtered visible query, so it counts matches,
not the page. When the caller passes no `limit` the query is unpaged and
`total` is the array length — one code path, and the wire response gains
fields without losing any, so the homepage widgets, the entity tab, and
the actions keep working. `limit` is clamped to 1..100 and `offset` to
`>= 0`; a non-numeric value is an `InputError` rather than a silently
ignored parameter.

The service method's return type changes from `BoardListEntry[]` to
`BoardListResult`, and `BoardsApi.listBoards` follows it. Rather than
touch every consumer, the existing hooks absorb it with react-query's
`select`: `useBoardListQuery` (the widget) and `useBoardsByEntityQuery`
(the entity tab) keep handing their components a plain array, and only
the new paged hook reads `total`. *Alternative rejected:* a second
`listBoardsPage` method beside the old one — two nearly identical listing
paths to keep in sync, and the old one would still be the unpaginated
full scan.

**Filter options come from `GET /boards/facets`, over the unfiltered
visible set.** It returns `{ total, entityRefs, creators }`:
`select distinct entity_ref from board_entities` joined to the visible
board ids, `select distinct created_by from boards` over the same ids,
both sorted, and the count of visible boards. Deliberately *not* narrowed
by the filters currently applied — options that vanish as you select them
make a filter impossible to widen again. `total` is what the "All" tab
label counts, so the label keeps meaning "boards you can see" while the
pagination footer below reports "x–y of N matching".

The route must be registered **before** `/boards/:boardId`, or express
matches `facets` as a board id and the endpoint returns 404 for everyone.
A router test asserts the endpoint answers rather than 404s.

*Alternative rejected:* computing the options in the browser from the
loaded page of boards. With pagination the browser only ever holds one
page, so the dropdowns would list the options of the current page — the
filter could not reach anything not already on screen.

**The bar copies `ItemFilterBar`'s shape, not its code.** Same 240px
`SearchField` (`aria-label="Search boards"`), same tertiary
`MenuTrigger` buttons, same growing match count and right-pinned "Clear
filters". It cannot reuse `useItemFilter`: that hook owns items, filters
them in memory, and derives its options from the rows it was handed —
every one of which is the opposite of what this bar does. What *is*
reused is the labelling: `useProfiles` over the refs the facets endpoint
returned, `refDisplayName` until the catalog answers, `RefLabel` for the
ref tooltip, options sorted by their resolved label. `useProfiles` asks
the catalog by ref, so it labels entity refs of any kind as well as
users.

**The two dropdowns select one option each**, unlike the tag and
assignee menus. The entity menu is "All entities" plus one entry per
ref; the creator menu is "Anyone" plus one entry per creator; the
selected entry carries the `✓`. This keeps the wire filter identical to
the `entityRef` parameter the catalog entity tab already uses and keeps
the SQL an equality. *Trade-off:* a user who learned multi-select on the
board page cannot ask for "team A or team B" here. If that turns out to
matter, both parameters become repeatable and the SQL becomes an `IN` —
the UI shape does not have to change again.

Typing is debounced 250ms before it becomes a request; the input's own
state updates immediately, so only the query key lags.

**Pagination is a footer component shared by both tabs.**
`TablePagination` renders "x–y of N boards", previous/next buttons
disabled at the bounds, and a page-size `Select` (10 / 25 / 50, default
25) in a fixed-width wrapper, as the my-items group-by select sits in.
It is built from BUI `Button`/`Text`/`Select`; if `@backstage/ui` turns
out to export a pagination primitive, that is used instead — the
component is the seam either way.

Changing any filter or the page size resets to page 1; otherwise a
narrowing filter can leave the user on a page that no longer exists.
Queries use `placeholderData: keepPreviousData` so paging keeps the
current rows on screen instead of flashing an empty table.

**Query keys and invalidation.** Paged listings live under
`['boards', 'page', params]` — *not* `['boards', 'list', …]`, which the
homepage widget already owns. Today's invalidations use
`{ queryKey: queryKeys.boards, exact: true }` (in `invalidateBoard`, and
in the `useBoardsSignal` handler on the list page), which by construction
cannot reach a new key — a favorite toggle or a remote board change would
leave a stale page. Both also invalidate the `['boards', 'page']` prefix.
The prefix is deliberately the page one and not the `['boards']` root,
which would drag `queryKeys.myItems` and every per-board key in with it.

**Empty and loading states go through `AsyncList`,** as the my-items
listing and the widgets do, which also splits the two empty reasons the
way my-items splits its own: "No boards are accessible to you yet.
Create one!" when the caller has no boards at all (`facets.total === 0`),
and "No boards match your filters." when a filter is active and the page
came back empty.

## Risks / Trade-offs

- **The SQL predicate and `computeEffectiveLevel` drift apart**, and a
  board becomes visible in the listing that the board page then refuses
  to open (or the reverse) → the parity test over the visibility × grant
  × principal matrix is the guard, and it is written before the predicate
  is used anywhere.
- **`principal_ref in (...)` grows with the user's group memberships.**
  A user in very many groups produces a long `IN` list. It is the same
  set `computeEffectiveLevel` already loads per board, now used once, so
  this is strictly less work than today; if a deployment ever hits a
  parameter limit the fix is a temporary table, not a redesign.
- **`lower(name) like ?` cannot use an index.** At the scale this page
  serves (hundreds of boards) a scan is fine; a trigram or expression
  index is a later, Postgres-specific optimisation, and the query shape
  does not have to change for it.
- **Offset paging can skip or repeat a row** if a board is created or
  renamed between two page requests. The `name, id` tiebreaker removes
  the ordering half of that; the insert half is inherent to offset paging
  and acceptable for a board list.
- **A third filter bar in the plugin, and the odd one out** — client-side
  in two places, server-side here. Mitigated by matching the visual and
  interaction shape exactly, so the difference stays an implementation
  detail; a shared presentational shell for all three is a refactor to
  consider once this one has settled.
- **The dropdowns can list an entity ref that no longer resolves in the
  catalog**, because they come from what boards reference rather than
  from the catalog → `refDisplayName` falls back to the ref's name and it
  still filters correctly, which is better than hiding a board's only
  entity.
- **Two tabs now issue their own request** where one request used to
  serve both, plus the facets request. That is two extra round trips on
  the boards page, against a response that no longer grows with the
  number of boards.

## Migration Plan

No schema change and no data migration: the visibility predicate reads
the tables the JavaScript filter already reads. The API change is
additive — new query parameters, new fields on the response, a new
endpoint — so an older frontend against a newer backend is unaffected,
and a newer frontend against an older backend is not a case this
repository ships (both move in the same commit).

Reverting the change restores the previous listing; the only thing a
revert must carry with it is the frontend, since `BoardsApi.listBoards`
changes shape in the same commit as its callers.

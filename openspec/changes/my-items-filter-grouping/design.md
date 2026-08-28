# Design

## Context

See `proposal.md` — Why. The constraints that actually shape this design:

- `MyItemsList` (`plugins/boards/src/components/MyItemsPage.tsx`) already
  loads the **complete** result of `GET /my-items` into the TanStack
  cache under `['boards', 'my-items']` and renders it with a local
  `groupByBoard()` helper. There is no paging and no server-side filter,
  so every field the new controls need (title, description, tags,
  assignees, due date, board name) is already in memory.
- `MyBoardItem` is `{ item: BoardItem, boardId, boardName, columnTitle }`.
  Its `item` is a full `BoardItem`, so `itemMatchesFilter(item, filter)`
  from `boards-common` applies unchanged.
- The board page's filter bar (`BoardPage.tsx`) is
  `SearchField` + a `MenuTrigger`/`Menu` tag toggle list + a count and a
  "Clear filters" button; its group-by is a `Select` with four options.
  Matching those two controls is the explicit ask, so this change reuses
  their code rather than their look.
- `components/grouping.ts` already holds two grouping families: board
  items (`GroupByMode`, `groupItems`) and my-items
  (`MyItemsGroupBy = 'board' | 'status' | 'dueDate'`, `groupMyItems`).
  The home page "Assigned items" widget is the only current caller of the
  my-items family, and its RJSF settings schema hard-codes those three
  values.
- `MyItemsList` is rendered by both `MyItemsPage` (the `/my-items` route)
  and `BoardListPage`'s "My items" tab, so anything added to it lands in
  both places at once.
- The frontend can read the viewer's identity through `identityApiRef`
  (`getBackstageIdentity()` → `userEntityRef`, `ownershipEntityRefs`);
  `ItemMenu.tsx` already does this via `useAsyncData`.

## Goals / Non-Goals

**Goals:**

- The my-items filter bar behaves identically to the board page's for
  the facets they share (text, tags), down to the AND semantics and the
  "N of M items" / "Clear filters" affordances.
- Grouping is a superset of what the page does today, with **board** as
  the unchanged default, so an untouched page looks exactly as it does
  now.
- No new request, no new endpoint, no widened response.
- The tag filter menu exists **once** in the codebase after this change.

**Non-Goals:**

- No server-side filtering of `/my-items` and no `ItemFilter` change: the
  assignee facet never leaves the browser.
- No persistence of filter or grouping state — not in the URL, not in
  local storage. The board page does not persist its own; matching it is
  the point. (`?item=` style deep links stay out of scope.)
- No new grouping option on the home page "Assigned items" widget. Its
  settings schema keeps `board | status | dueDate`.
- No status grouping on the my-items page (the board column is already a
  per-row badge, and the ask names board / none / due date / tags).
- No sorting controls, no saved views, no per-group collapse.
- No e2e test: the behavior is local to one component and covered by
  component tests, matching how the board page's own filter bar is
  covered.

## Decisions

### 1. Filtering stays client-side and reuses `itemMatchesFilter`

The page holds every entry already, so a `useMemo` over the loaded array
is both the cheapest and the most consistent option: text and tag
matching then come out of the same `boards-common` function the board
page and the backend use, and cannot drift.

A new my-items-only helper in `grouping.ts` composes the shared matcher
with the assignee facet:

```ts
export interface MyItemsFilter {
  text?: string;
  tags?: string[];
  /** Viewer identity refs; an entry matches if it carries ANY of them. */
  assignees?: string[];
}

export function filterMyItems(
  entries: MyBoardItem[],
  filter: MyItemsFilter,
): MyBoardItem[];
export function isEmptyMyItemsFilter(filter: MyItemsFilter): boolean;
```

`filterMyItems` delegates to `itemMatchesFilter(entry.item, { text, tags })`
and then checks the assignee facet. `ItemFilter` in `boards-common` is
**not** extended: it is the shape the items API accepts, and an assignee
field there would advertise a query parameter that does not exist.

### 2. The assignee facet lists the viewer's own identities, OR-combined

The my-items list only ever contains items assigned to one of the
viewer's refs, so the useful question the facet answers is *"through
which of my identities is this mine?"* — personally, or via
`group:default/team-a`, or via `group:default/platform`.

- **Options** = the viewer's refs (`userEntityRef` +
  `ownershipEntityRefs`, de-duplicated) that appear on at least one
  loaded entry's `assignees`. Comparison is case-insensitive on the full
  entity ref, because catalog refs round-trip with inconsistent casing.
- **Visibility**: rendered only when that intersection has **two or more**
  entries. With one, every row would match and the control could not
  exclude anything.
- **Semantics**: selecting several keeps entries assigned to **any** of
  them (OR). Tags stay AND. The difference is deliberate: an item is
  rarely assigned to both a user *and* their group, so AND would render
  most selections empty, while the tag AND is what the board page's spec
  already promises.
- Co-assignees (a colleague on a shared item) are **not** offered. They
  are not why the item is in this list, and offering them would turn a
  three-entry menu into a directory.

Rejected alternative: listing every distinct assignee ref found on the
entries. It answers a different question ("who else is on this?"),
scales with team size, and makes the ">1 assignee" visibility rule fire
on lists where the viewer has only one identity.

`identityApiRef` is read with the existing `useAsyncData` helper. Identity
failing to resolve is not an error state for the page: the facet is
simply hidden, and text/tags/grouping keep working.

### 3. Grouping widens the existing my-items family

`MyItemsGroupBy` becomes `'none' | 'board' | 'status' | 'dueDate' | 'tags'`
and `groupMyItems` handles the two new modes:

- `none` → a single group `{ key: 'all', label: '', entries }`, rendered
  without a heading.
- `tags` → one group per tag, ordered alphabetically, an entry appearing
  in **each** of its tag groups, and a trailing `UNTAGGED` group labelled
  "Untagged" — the same shape `groupItems(items, 'tags')` produces for
  board items.

`board`, `status` and `dueDate` keep their current behavior and ordering
(due dates chronological, so overdue first, with `NO_DUE_DATE` last).
Widening the union is source-compatible for the home page widget: its
`groupBy` prop type widens, its schema does not, and its default stays
`board`.

Rejected alternative: a separate `MyItemsPageGroupBy` type plus a second
grouping function. It would duplicate the board/status/due-date logic
that already exists purely to avoid touching one union.

### 4. The Board column appears when the grouping is not by board

Today each group heading *is* the board name and links to the board.
Under `none`, `dueDate` or `tags` a row would otherwise not say where it
lives. So the table renders `Board | Item | Status | Due | Tags | Actions`
whenever `groupBy !== 'board'`, with the board cell a link to the board;
under `board` the columns are exactly today's five. "Open board" stays in
the row menu in both cases.

Group headings by mode:

| Mode | Heading |
| --- | --- |
| `board` | board name as a link (today's `Button`), plus entry count |
| `none` | no heading — one plain table |
| `dueDate` | relative label via `relativeDueLabel` ("Overdue", "Due today"), falling back to `formatDueDate`; "No due date" last |
| `tags` | the tag; "Untagged" last |

The due-date and tag labels come from the same helpers `GroupLabel`
already uses for board grouping, so the two pages read alike.

### 5. One tag filter menu, shared

`BoardPage`'s inline tag `MenuTrigger` is extracted to
`components/FilterBar.tsx` as:

```tsx
<MultiSelectFilterMenu
  label="Tags"          // renders `Tags (2)` when 2 are selected
  ariaLabel="Filter by tags"
  options={allTags}     // { value, label }[] for the assignee menu
  selected={filterTags}
  onChange={setFilterTags}
/>
```

The same component renders the assignee menu with entity-name labels, so
the ✓-prefix toggle behavior is written once. `assigneeLabel` (currently
private in `ItemMenu.tsx`, handling `text:` refs and `parseEntityRef`)
moves to `common.tsx` and is exported for that.

`BoardPage` is refactored to use the component in the same commit; its
existing tests must pass unchanged, which is the regression check for the
extraction.

### 6. State lives in `MyItemsList`

`filterText`, `filterTags`, `filterAssignees` and `groupBy` are
`useState` in `MyItemsList`, defaulting to `''`, `[]`, `[]` and `'board'`
— the same pattern and the same defaults-shaped decision as `BoardPage`.
Putting them in `MyItemsList` rather than `MyItemsPage` is what gives the
boards page's "My items" tab the same controls for free.

Filtering runs before grouping (`useMemo` on entries + filter, then
`useMemo` on the result + mode), so a group that filters down to nothing
disappears instead of rendering an empty table.

## Risks / Trade-offs

- **Tag AND vs assignee OR in one bar** → a user could reasonably expect
  one rule. Mitigated by the visible count ("12 of 40 items") and by tags
  keeping the semantics the board page's spec already states; the
  assignee menu is at most a three-item list where OR is the obvious
  reading.
- **`MyItemsGroupBy` widening reaches the home page widget's prop type** →
  a widget stored with an out-of-schema value would now type-check. It
  cannot get one: the schema is the only writer, and the component
  already defaults an unknown/absent prop to `board`.
- **Extracting the tag menu touches a working board page** → the
  extraction is mechanical (same markup, props instead of closures) and
  `BoardPage.test.tsx` covers the filter bar; the tests are not modified,
  so a behavioral drift fails the build.
- **Grouping by tags multiplies rows** → an item with four tags renders
  four times, which is the established board-grouping behavior and is
  what makes "everything tagged `release`" answerable. The per-group
  count makes the duplication legible.
- **Identity-derived options depend on the catalog's ownership refs** →
  if an app resolves no ownership refs, the assignee facet never shows.
  That is the correct outcome (there is only one identity in play), not a
  degraded one.

## Migration Plan

None. Every change is additive and frontend-local: new local state, new
optional grouping modes on an existing function, and a component
extraction with no API surface outside the plugin. Rolling back is
reverting the commit — nothing is persisted, no response shape moves, and
the default rendering (grouped by board, unfiltered) is byte-identical to
today's.

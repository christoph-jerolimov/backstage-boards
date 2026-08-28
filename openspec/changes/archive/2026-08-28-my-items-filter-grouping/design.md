# Design

## Context

See `proposal.md` — Why. The constraints that actually shape this design,
all of them on the current `main`:

- The board filter bar is already reusable:
  `components/BoardFilterBar.tsx` exports `useItemFilter(items:
  BoardItem[])` — owning the text/tag/assignee state, resolving assignee
  labels through `useProfiles` and sorting them — and `BoardFilterBar`,
  which renders the search field, the two menus, the "N of M items" count
  and "Clear filters". It offers the assignee menu whenever
  `assigneeOptions.length > 0`.
- `ItemFilter` in `boards-common` already carries `text`, `tags` and
  `assignees`, and `itemMatchesFilter` already combines them with the
  right semantics: text substring, **all** tags, **any** assignee.
- `MyItemsList` (`components/MyItemsPage.tsx`) loads the complete
  `GET /my-items` result via `useMyItemsQuery()` and renders it through a
  local `groupByBoard()`. There is no paging and no server-side filter,
  so every field the controls need is already in memory.
- `MyBoardItem` is `{ item: BoardItem, boardId, boardName, columnTitle }`,
  so `itemMatchesFilter(entry.item, filter)` applies unchanged.
- **`BoardGroupTable` is per board today**: it calls
  `useBoardQuery(group.boardId)` once per group and uses that board for
  `StatusBadge`, the `canWrite` check, and the `ItemActions` bound to
  `group.boardId`. A group that spans boards breaks that assumption — the
  central structural problem of this change.
- `grouping.ts` holds two grouping families: board items (`GroupByMode =
  none | assignee | dueDate | tags`, `groupItems`, `groupKeysOf`,
  `REST_KEY`) and my-items (`MyItemsGroupBy = board | status | dueDate`,
  `groupMyItems`). The home page "Assigned items" widget is the only
  caller of the my-items family, and its RJSF schema hard-codes its three
  values.
- `GroupLabel` already renders a heading for a `GroupByMode` group key —
  relative due-date labels, the tag, "Untagged", "No due date".
- `BoardHeader` renders the group-by `Select` with
  `selectedOption(key, ALL_GROUP_BY_MODES)`.
- `MyItemsList` is rendered by both `MyItemsPage` (`/my-items`) and
  `BoardListPage`'s "My items" tab, so anything added to it lands in both.

## Goals / Non-Goals

**Goals:**

- One filter bar implementation for both pages, including the catalog
  display names for assignees.
- Grouping is a superset of today's behavior, with **board** as the
  unchanged default, so an untouched page looks exactly as it does now.
- The row menu keeps working identically in every grouping, including
  the write-access and externally-managed restrictions that need the
  item's board.
- No new request per row and no new endpoint.

**Non-Goals:**

- No change to `boards-common`, the items API, or `/my-items`.
- No change to the board page's filter behavior; the file rename is
  mechanical.
- No persistence of filter or grouping state — not in the URL, not in
  local storage. The board page does not persist its own.
- No new grouping option on the home page "Assigned items" widget: its
  settings schema keeps `board | status | dueDate`.
- No status grouping on the my-items page (the column is already a
  per-row badge, and the ask names board / none / due date / tags).
- No sorting controls, no saved views, no per-group collapse.

## Decisions

### 1. Reuse `useItemFilter` over the entries' items

`useItemFilter` wants `BoardItem[]`; my-items holds `MyBoardItem[]`. The
hook is used on the mapped items and the entries are filtered with the
handle's own filter:

```ts
const items = useMemo(() => (entries ?? []).map(entry => entry.item), [entries]);
const filter = useItemFilter(items);
const filtered = useMemo(
  () => (entries ?? []).filter(entry => itemMatchesFilter(entry.item, filter.filter)),
  [entries, filter.filter],
);
```

Nothing in the hook changes. Its `filteredItems`/`totalCount` — and so
the bar's "N of M items" — stay correct for my-items because the mapping
is 1:1 (an item id appears once in the listing).

Rejected: a parallel `useMyItemsFilter`. It would duplicate the state,
the profile resolution and the label sorting to save one `map`.

Rejected: making `useItemFilter` generic over a row type with an accessor.
It complicates the board page's call site for a single extra caller.

### 2. `minAssigneeOptions` on the shared bar

The ask is that my-items offers the assignee filter only when more than
one assignee is found. That rule is right for my-items and wrong for a
board: every my-items entry is assigned to the viewer, so one option
matches every row and can exclude nothing, while on a board a single
option still separates assigned from unassigned items.

So the rule is a prop, not a change of behavior:
`BoardFilterBar` takes `minAssigneeOptions?: number` (default `1`, the
board page's current behavior) and renders the menu only when
`assigneeOptions.length >= minAssigneeOptions`. My-items passes `2`.

The options themselves stay the hook's: **every** assignee found on the
listed items, catalog-labelled. That includes a colleague who shares one
of the viewer's items — which is what makes the count exceed one for a
user with a single identity, and is the same list the board bar offers.

Rejected: restricting the options to the viewer's own identity refs
(user ref + ownership refs, read through `identityApiRef`). It answers a
narrower question ("through which of my identities is this mine?"),
needs an identity round-trip and a case-insensitive ref match, and it
would have my-items offer a *different* assignee list than every other
filter bar in the plugin. The `>= 2` rule already keeps the menu away
when it would be useless.

### 3. Rename `BoardFilterBar` → `ItemFilterBar`

The component now serves the board page and the my-items page. The file
becomes `components/ItemFilterBar.tsx`, the component `ItemFilterBar`;
`useItemFilter`, `ItemFilterHandle` and `AssigneeOption` keep their names
and move with it. `BoardPage.tsx` is updated in the same commit, and
`BoardPage.test.tsx` stays **unmodified** as the regression check.

### 4. Grouping widens the my-items family

```ts
export type MyItemsGroupBy = 'none' | 'board' | 'status' | 'dueDate' | 'tags';
/** The groupings the my-items page offers, in menu order. */
export const MY_ITEMS_PAGE_GROUP_BY = ['board', 'none', 'dueDate', 'tags'] as const;
```

`status` stays in the type for the home page widget but is not on the
page's menu; the page validates its `Select` with
`selectedOption(key, MY_ITEMS_PAGE_GROUP_BY)`, exactly as `BoardHeader`
does with `ALL_GROUP_BY_MODES`.

`groupMyItems` gains the two modes, and the multi-valued one reuses the
board family's key logic rather than restating it — `dueDate` and `tags`
delegate to the existing `groupKeysOf(entry.item, mode)` / `REST_KEY[mode]`
so both pages group by the same rules:

- `none` → one group `{ key: 'all', label: '', entries }`.
- `tags` → one group per tag, alphabetical, an entry in **each** of its
  tag groups, trailing `UNTAGGED` group.
- `dueDate` → unchanged: chronological (most overdue first), trailing
  `NO_DUE_DATE`.
- `board`, `status` → unchanged.

Widening the union is source-compatible for the widget: its `groupBy`
prop type widens, its schema does not, and it already defaults an
absent prop to `board`.

### 5. Rows resolve their own board

This is what the grouping change actually costs. Today one board query
serves a whole table; under `none`, `dueDate` or `tags` a table mixes
boards, and each row still needs its board for the status badge's color,
`canWrite`, and the actions bound to the right board id.

`queries.ts` gains:

```ts
/** The boards behind a set of entries, as a map, one query each. */
export function useBoardsQueries(boardIds: string[]): Map<string, Board>;
```

implemented with TanStack's `useQueries` over `queryKeys.board(id)` and
`boardsApi.getBoard(id)` — the same key `useBoardQuery` uses, so a board
already in the cache (the board page, another group) costs nothing and a
row never triggers its own request. `MyItemsList` calls it once with the
distinct board ids across **all** entries, so the set does not change
when the grouping or the filter does.

`BoardGroupTable` becomes `MyItemsTable({ entries, boards, basePath,
showBoardColumn, onError })`: it renders any group, looks each row's
board up in the map, and builds that row's `ItemActions` for
`entry.boardId`. The board falling back to `undefined` keeps today's
behavior — the listing's own `columnTitle` in a plain `Badge`, no write
actions — which is also what an unreadable board would give.

`useRowMenu` stays one per table, keyed on `MyBoardItem` instead of
`BoardItem` so its `children` can reach `entry.boardId`. The quick-assign
pool is computed once from all entries rather than per board; it is a
convenience list, and "whoever shares my items" is if anything the better
pool.

Rejected: a component per row calling `useBoardQuery`. It works, but it
would fragment the row menu, which is deliberately one per table.

### 6. Headings, and the Board column

| Mode | Heading |
| --- | --- |
| `board` | board name as today's link button, plus entry count |
| `none` | no heading — one plain table |
| `dueDate` | `<GroupLabel mode="dueDate" groupKey={key} />` — "Due today", "Overdue", "No due date" last |
| `tags` | `<GroupLabel mode="tags" groupKey={key} />` — the tag, "Untagged" last |

`GroupLabel` takes a `GroupByMode`, and `dueDate`/`tags` are literals of
both unions, so the two pages read alike with no new label code.

Under `board` the columns stay exactly today's five (Item, Status, Due,
Tags, Actions). In every other mode a leading **Board** column is added,
linking to the board, so a row still names where it lives. "Open board"
stays in the row menu in both cases.

### 7. State, order of operations, empty states

`groupBy` (default `'board'`) is `useState` in `MyItemsList`; the filter
state lives in `useItemFilter`. Filtering runs **before** grouping, so a
group whose entries all filter out is never rendered.

`AsyncList`'s `empty` node becomes filter-aware: "Nothing is assigned to
you on any board." when no filter is active, "No items match your
filters." when one is. The distinction matters — the first message is
wrong and confusing while a filter is on.

## Risks / Trade-offs

- **`useBoardsQueries` fires one request per distinct board** on a first
  visit to `/my-items`. It is bounded by the number of boards the user
  has items on, it is what the page already does today (one
  `useBoardQuery` per board group), and every board the user opens
  afterwards is a cache hit.
- **Renaming the filter bar touches a working board page** → the rename
  is mechanical and `BoardPage.test.tsx` is not modified, so any drift
  fails the build.
- **`minAssigneeOptions` makes the two bars behave differently** → one
  prop, defaulted to today's behavior, documented where it is declared.
  The alternative (same rule everywhere) would either hide a useful board
  filter or show a useless my-items one.
- **Grouping by tags multiplies rows** → an item with four tags renders
  four times. That is the established board-grouping behavior and is what
  makes "everything tagged `release`" answerable; the per-group count
  makes it legible.
- **`MyItemsGroupBy` widening reaches the widget's prop type** → a widget
  stored with an out-of-schema value would now type-check. It cannot get
  one: the schema is the only writer, and the component defaults an
  unknown or absent prop to `board`.

## Migration Plan

None. Every change is frontend-local and additive: new local state, new
optional grouping modes on an existing function, one new optional prop,
a file rename, and a query helper over an existing query key. Rolling
back is reverting the commit — nothing is persisted, no response shape
moves, and the default rendering (grouped by board, unfiltered) is
identical to today's.

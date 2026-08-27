# Design

## Context

See `proposal.md` — Why. The constraints that actually shape this design:

- The plugin is **new frontend system only** (`createFrontendPlugin` in
  `plugins/boards/src/plugin.tsx`). Home page widgets are contributed
  with `HomePageWidgetBlueprint` from `@backstage/plugin-home-react/alpha`,
  which attaches to `page:home` / `widgets` by default. The app already
  uses that blueprint for its `GettingStarted` card.
- The blueprint's widget takes its settings from an **RJSF schema**
  (`params.settings.schema`). `CustomHomepageGrid` — the default home
  layout — stores each placed card's settings in home storage and spreads
  them onto the widget element as **props**
  (`{...widget.component.props, ...w.settings}`). Stored settings start
  out as `{}`, so schema `default`s are *not* applied for a card the user
  never configured; the component has to default its own props.
- The boards pages provide their own TanStack `QueryClientProvider`
  (`boardsQueryClient`, from `BoardsPage`/`EntityBoardsContent`). A home
  page widget is rendered outside those pages, so it has no query client.
- `GET /my-items` already returns everything the "Assigned items" card
  needs (item, `boardId`, `boardName`, `columnTitle`).
- `GET /boards` returns `BoardListEntry` — a board plus `access` and
  `favorite`. It carries **no columns and no item counts**.

## Goals / Non-Goals

**Goals:**

- Both cards work with zero app wiring beyond installing the plugin.
- Settings are per placed card and survive a reload, using the home
  grid's own mechanism rather than a private store.
- The "Boards" card costs **one** request whether counts are on or off.
- Cards reuse existing components (`DueDateBadge`, `StatusBadge`,
  `ColumnDot`) and the existing query keys, so a card and a boards page
  open at once do not fetch the same data twice.

**Non-Goals:**

- No old-frontend-system (`createCardExtension`) variant.
- No new filters beyond the four settings in the specs — no per-board
  filter, no assignee override, no item limit or paging.
- No write actions from a card: no drag/drop, no status change, no
  favorite toggle. Cards are read-only entry points.
- No custom home page layout extension (`HomePageLayoutBlueprint`).

## Decisions

### 1. RJSF `settings.schema`, not a custom `Settings` component

`ComponentParts` allows a hand-written `Settings` element, but
`CardExtension` only renders it when `settings.schema` is **absent**
(`isCustomizable === false`), and such a component would have to persist
its own state somewhere. Declaring a schema instead gets persistence,
the settings dialog, and per-card isolation from the grid for free.

Settings become props, so each widget's props are exactly its schema
properties:

| Widget | Prop | Values | Default |
| --- | --- | --- | --- |
| Assigned items | `scope` | `all` \| `due` | `all` |
| Assigned items | `groupBy` | `board` \| `status` \| `dueDate` | `board` |
| Boards | `scope` | `favorites` \| `all` | `favorites` |
| Boards | `showCounts` | boolean | `false` |

Labelled choices use RJSF v5's `oneOf: [{ const, title }]` form rather
than the deprecated `enumNames`. Every component destructures with a
default (`scope = 'all'`) because an unconfigured card arrives with no
props at all — the schema `default` is documentation, not a runtime
guarantee.

*Alternative considered:* one `settings` object prop. Rejected — the
grid spreads settings as top-level props, so a nested object would need
a wrapper the grid does not provide.

### 2. `ContextProvider` supplies the query client

`ComponentParts.ContextProvider` wraps the card body, which is exactly
where `QueryClientProvider client={boardsQueryClient}` belongs. Reusing
the shared client (rather than a fresh one per card) means a card and the
boards page share the `['boards', 'my-items']` cache entry, and two cards
on the same home page share one in-flight request.

*Alternative considered:* `useAsync` and no TanStack query. Rejected —
it would duplicate fetches, drop the shared cache, and diverge from every
other component in the plugin.

### 3. Counts come from the listing endpoint, not N+1 requests

Rendering "3 Todo / 1 In Progress / 0 Done" per board needs each board's
columns and its item counts. Today that is `getBoard` + `listItems` per
board — on a home page with ten boards, twenty requests on every load.

Instead `listBoards` takes `withCounts`, and after the existing access
filter runs it issues two extra queries over the surviving board ids:
`board_columns` for those boards (ordered by position), and a
`count(*) … group by column_id` over non-archived `items` for those
boards. Columns with no matching count row become `count: 0`, so a
board's shape stays readable. Access is unchanged because the counts are
computed *after* `effectiveLevel` filtering — a board the caller cannot
read is never in the id list.

Shape in `boards-common`:

```ts
export interface BoardStatusCount {
  columnId: string;
  title: string;
  color?: ColumnColor;
  count: number;
}
// BoardListEntry gains:
  /** Present only when the listing was asked for counts. */
  statusCounts?: BoardStatusCount[];
```

Optional field ⇒ additive ⇒ no existing caller changes. `GET /boards`
reads `?counts=true`; `BoardsClient.listBoards` gains `withCounts`.

*Alternatives considered:* (a) always return counts — makes every
existing `listBoards` call, including the entity tab's, pay for two
extra queries; (b) a separate `GET /boards/counts` endpoint — a second
round trip and a second access-filter implementation to keep in sync.

### 4. Grouping is client-side, on data already fetched

`MyBoardItem` carries `boardName` and `columnTitle`, so all three
grouping modes are pure functions over the `/my-items` response. Status
grouping keys on `columnTitle`, which is what makes "Todo" from two
different boards land in one group, as the spec requires.

The card reuses the existing `['boards', 'my-items']` query key, so it
shares the cache with `MyItemsList`. Grouping and the `due` filter run in
a `useMemo` over that data — changing a setting re-renders, it does not
refetch.

The `due` filter compares `item.dueDate <= todayISO()` using the existing
`boards-common/dates` helpers; both sides are `YYYY-MM-DD`, so string
comparison is correct and local-timezone-aware, matching `dueState`.

New helpers live next to the existing grouping code
(`components/grouping.ts`) rather than in the widget, so they are unit
testable without rendering: `filterDue(entries, now)` and
`groupMyItems(entries, mode)` returning `{ key, label, entries }[]` in
the order the spec fixes (alphabetical for board/status; chronological
with undated last for due date).

### 5. The Boards card gets its own query key

`invalidateBoard` invalidates `queryKeys.boards` with `exact: true`, so a
new key `['boards', 'list', { favoritesOnly, withCounts }]` is not caught
by it. That is deliberate: the card's freshness comes from the `boards`
signal channel (`useSignal('boards')` → `refetch`), the same mechanism
`MyItemsList` and `BoardListPage` already use, and it keeps the four
setting combinations cached separately instead of thrashing one entry.

### 6. Rendering

Card bodies are `@backstage/ui` (BUI) components, like the rest of the
plugin, inside the home page's MUI `InfoCard` — the same mix the boards
pages already ship. Cards are compact lists, not `TableRoot`s: a home
page card is ~4 grid columns wide and a five-column table does not fit.

- Assigned items: group heading (label + count, board headings link to
  the board) then one row per item — title, `StatusBadge`, `DueDateBadge`.
- Boards: one row per board — name, and when `showCounts` is on a row of
  `ColumnDot` + title + count chips built from `statusCounts`.
- Navigation goes through `useRouteRef(rootRouteRef)` with the
  `?? '/boards'` fallback `MyItemsPage` already uses; an item links to
  `<base>/<boardId>?item=<itemId>`, a board to `<base>/<boardId>`.
- Layout hints: default 4 columns × 6 rows, min 3 × 3, max 12 columns.
  The card body scrolls internally rather than growing, so a user with
  200 assigned items does not get a 200-row card.

### 7. Extension naming

Widget names are the identifiers `app-config.yaml`'s `defaultConfig`
references, so they are fixed here: `BoardsAssignedItems` and
`BoardsList` (extensions `home-page-widget:boards/assigned-items` and
`home-page-widget:boards/boards`). Both are added to the demo app's
`page:home` `defaultConfig`.

## Risks / Trade-offs

- **An app without `@backstage/plugin-home` has no `page:home`** → the
  two extensions are orphaned. The app tree resolver treats an unresolved
  attachment point as an orphan, not a fatal error, so such an app still
  starts and simply renders no boards widgets. Nothing to mitigate in
  code; called out so it is not mistaken for a bug.
- **`HomePageWidgetBlueprint` is `@alpha`** → its params may change in a
  future Backstage release. Mitigated by keeping the blueprint call thin:
  all logic lives in the widget components, which are plain React and
  independently tested.
- **Schema defaults are not applied to unconfigured cards** → a widget
  that trusted `default` would render empty on first add. Mitigated by
  defaulting in the component and covering it with a test that renders
  each widget with no props.
- **`showCounts` costs two extra queries per listing** → paid only when a
  user turns it on, and bounded by the number of boards the user can
  read (grouped aggregate, not per-board round trips).
- **`?counts=true` widens the listing response** → the field is optional
  and absent by default, so no existing consumer or test changes.
- **Signal-driven refresh only** → if the signals API is not installed in
  an app, cards refresh on remount rather than live. This is the existing
  behavior of `MyItemsList` and `BoardListPage`; no new exposure.

## Migration Plan

No migration. Every piece is additive: a new optional field on an
existing response, a new optional query parameter, and two new
extensions. Rolling back means removing the extensions; no data written,
no schema change, no persisted format beyond the home grid's own settings
storage, which tolerates unknown/missing widgets.

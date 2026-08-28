# Design

## Context

See `proposal.md` — Why. The constraints that shape this design:

- `ItemDrawer` already takes everything it needs as props:
  `board: BoardWithContext`, `item: BoardItem`, `canWrite`,
  `tagSuggestions`, `onClose`, `onChanged`. It is `position: fixed` and
  renders its own backdrop, so it is not bound to the board layout — it
  is only ever *constructed* by `BoardPage`.
- `BoardPage` derives those props from `useBoardQuery(boardId)` (columns
  and `access`) and `useItemsQuery(boardId)` (the item itself, and the
  tag suggestions from every item on the board). Both are plain TanStack
  queries keyed `['boards', boardId]` / `['items', boardId]`.
- The list surfaces have less: `MyBoardItem` carries `item`, `boardId`,
  `boardName`, `columnTitle` — no columns and no access level. So a
  drawer opened from a list must fetch the board.
- `MyItemsList` is rendered twice: as the `/boards/my-items` page and as
  the `my-items` tab panel of `BoardListPage` at `/boards`. The tab
  selection is component state, not in the URL.
- The home page card runs outside the boards pages; `BoardsWidgetProvider`
  supplies `boardsQueryClient`, and a `Router` is present (the card
  already calls `useNavigate` and `useRouteRef`).
- `invalidateBoard` invalidates `['boards', boardId]`, `['items', boardId]`
  and `['boards']` with `exact: true`. The my-items key
  (`['boards', 'my-items']`) and the card's listing key
  (`['boards', 'list', options]`) are deliberately *not* matched by that
  exact invalidation.

## Goals / Non-Goals

**Goals:**

- One drawer implementation, one set of edit behaviors, three places it
  can appear: board page, my-items list, home page card.
- Opening a drawer from a list costs no new endpoint and no duplicate
  fetch — it warms exactly the cache entries the board page would use.
- Edits made from a list refresh the list underneath.
- The drawer opened away from its board still gets the user to that board
  in one click.
- The my-items drawer is linkable and closes with the back button.

**Non-Goals:**

- No change to what the drawer can do. Same fields, same permissions,
  same endpoints; this change is about *where* it can be opened.
- No drawer on the board *listing* rows, the entity tab, or the "Boards"
  home page card — those list boards, not items.
- No focus trap, no modal semantics, no drawer routing library. The
  existing non-modal overlay behavior (Backstage UI popovers portal above
  it) is kept exactly as it is; changing it would regress the pickers.
- No prefetch of every board behind a list. A board is fetched when its
  item is opened, not before.
- No multi-drawer stacking or history of visited items.

## Decisions

### 1. `ItemDrawerHost` — one component that turns ids into a drawer

New `components/ItemDrawerHost.tsx`:

```ts
export function ItemDrawerHost(props: {
  boardId: string;
  itemId: string;
  onClose: () => void;
  /** Offer "open this item's board"; omitted on the board page itself. */
  onOpenBoard?: (boardId: string) => void;
}): JSX.Element;
```

It runs `useBoardQuery(boardId)` and `useItemsQuery(boardId)`, finds the
item, computes `canWrite = levelIncludes(board.access, 'write') &&
!board.archivedAt` and `tagSuggestions` from the board's items — the same
three derivations `BoardPage` does today — and renders `ItemDrawer`.
`onChanged` invalidates through `invalidateBoard`.

The two callers differ only in how they hold the target and in whether
they pass `onOpenBoard`; everything else is shared. `BoardPage` keeps
constructing `ItemDrawer` directly: it already has `board` and `items` in
hand from queries it needs anyway, and routing it through the host would
add a second copy of the same derivations for nothing.

*Alternative considered:* make `ItemDrawer` itself fetch by id, and pass
ids everywhere. Rejected — it would make the board page refetch data it
already holds, and turn a pure presentational component into a data
component with three loading states.

### 2. The drawer chrome becomes reusable, so loading and error look right

Fetching before rendering introduces states `ItemDrawer` has never had:
in flight, board failed to load, item not found (deleted or archived
while the list was stale). Rendering nothing during them would make a
click look ignored.

So the backdrop + right-hand panel markup moves out of `ItemDrawer` into
an exported `ItemDrawerShell({ ariaLabel, onClose, children })` in the
same file. `ItemDrawer` renders its body inside it; `ItemDrawerHost`
renders a one-line message inside the same shell for each non-ready
state, with a close button. Escape-to-close and backdrop-click-to-close
move into the shell, so every state closes the same way.

The panel keeps `role="dialog"` and its `aria-label`; the host's states
label it `Item details` until the item is known.

Item-not-found is a *message*, not an auto-close: a drawer that vanishes
on open reads as a bug. The message names the likely cause ("this item is
no longer on the board — it may have been deleted or archived").

### 3. "On board X" in the drawer, only when it is not obvious

`ItemDrawer` gains one optional prop, `onOpenBoard?: () => void`. When
given, a line under the header reads `On board <BoardName>` with the name
as a tertiary button that calls it. `board.name` is already on the
`BoardWithContext` the drawer holds, so no extra data is needed.

`BoardPage` does not pass it — the board is already on screen. The
my-items list and the card do, navigating to `<base>/<boardId>`. This is
what replaces the navigation the click used to perform, and it is the
only reason the "status" and "due date" grouping modes of the card remain
comprehensible: without it, an item row in those modes never says which
board it is from.

### 4. `invalidateBoard` also refreshes the lists

`invalidateBoard` gains two invalidations: `['boards', 'my-items']`, and
`['boards', 'list']` as a prefix (matching the card's four option
combinations). Inactive queries are only marked stale, so a board page
with no list mounted pays nothing; a mounted my-items list refetches.

Putting this in `invalidateBoard` rather than in the host means the board
page gets it too — moving an item there already should have invalidated
my-items, and did not. `queryKeys` gains `myItems` and `boardLists` so
the keys are written once.

*Alternative considered:* have the host invalidate the list keys itself.
Rejected — the staleness is caused by the item write, not by which
component hosted the drawer.

### 5. My items: the open item lives in the URL

`MyItemsList` reads `useSearchParams()` for `board` and `item`. Row
activation and the "Open item" menu entry set both; closing deletes both.
Two parameters are needed because, unlike the board page, the list spans
boards.

This buys deep links, reload survival, and back-button close for free,
and it matches the board page's existing `?item=` convention. It also
means the `/boards/my-items` page and the `my-items` tab behave
identically without sharing state.

Because the tab is not in the URL, `BoardListPage` initializes its tab
state to `my-items` when an `item` parameter is present, so
`/boards?board=…&item=…` lands on the list the drawer belongs to instead
of the Favorites tab.

`setSearchParams` is called with `{ replace: false }` for opening (so
back closes) and the parameters are removed on close.

*Alternative considered:* component state, as in the card. Rejected here
— these are real pages the user can link to and reload, and the board
page's `?item=` already set the expectation.

### 6. The card: component state, not the URL

`AssignedItemsContent` holds `const [openItem, setOpenItem] =
useState<{ boardId: string; itemId: string } | undefined>()`.

The home page is not the plugin's route: writing to its query string
means one plugin's card mutating a shared address. Worse, two "Assigned
items" cards on one home page both read that string and would both mount
a drawer for one click. Component state keeps each card self-contained.

The cost — the drawer does not survive a reload of the home page and is
not linkable there — is acceptable for a dashboard card, and the "On
board X" link gives the user a linkable destination whenever they want
one.

### 7. What the list rows do now

| Surface | Row / item click | "Open item" menu entry | "Open board" menu entry | Board group heading |
| --- | --- | --- | --- | --- |
| My items page & tab | opens drawer in place | opens drawer in place | navigates to board | navigates to board |
| Assigned items card | opens drawer in place | — | — | navigates to board |

`RowContextMenu` and `RowActionsMenu` keep both entries, so "take me to
the board" is never more than one menu away. No entry is removed and no
label changes: "Open item" now opens the item where the user is.

## Risks / Trade-offs

- **A drawer over the home page sits under the Backstage sidebar** if the
  app's sidebar z-index exceeds the drawer's 901. The drawer is on the
  right and the sidebar on the left, so they do not overlap visually —
  the same situation the board page already has. Verified manually
  rather than mitigated in code; called out so it is not rediscovered as
  a bug.
- **Two fetches on first open** (board + items) where the old navigation
  also fetched them. Same cost, moved earlier; and the cache entries are
  the board page's own, so a later "Open board" is instant.
- **`tagSuggestions` requires the board's whole item list**, which is the
  only reason `useItemsQuery` is fetched at all in the host. Accepted:
  it is one request, it is the request the board page makes, and the item
  itself comes from it.
- **An item edited to no longer be assigned to the user** disappears from
  the list under the open drawer. The drawer stays open and functional
  because it reads from the board's item query, not from the my-items
  entry — deliberate, so an accidental assignee removal is undoable
  without hunting for the item again.
- **Deep-linking `/boards?board=…&item=…`** forces the my-items tab. A
  user who reloads that URL after closing the drawer lands on My items
  rather than Favorites; the close removes the parameters, so this only
  affects a stale bookmark.
- **The card's drawer is lost on reload.** Documented trade-off of §6.

## Migration Plan

None needed. Every change is additive or internal: one new component, one
extracted shell, one optional prop, two extra cache invalidations, and
new query parameters that older links simply do not carry. The old
`/boards/<boardId>?item=<itemId>` deep link keeps working exactly as
before, so existing bookmarks, notification links and the board page are
unaffected. Rolling back means restoring the two `navigate` calls.

# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- `TableView` (`plugins/boards/src/components/TableView.tsx`) owns
  view-local state already (`sort`, line 129) and renders either one
  `ItemsTable` (`groupBy === 'none'`) or **one `TableRoot` per group**
  from `groupItems(items, groupBy, board.priorities)`. Multi-valued
  group modes (assignee, tags) put the same item into several groups.
  `TableView` stays mounted while the table view is active — `BoardPage`
  only swaps the `groupBy` prop — so state kept there survives a
  group-by change.
- Rows use `onRowAction={key => openItem(String(key))}` for the whole
  row; the row is keyed by `item.id`. There is no selection anywhere in
  the app today.
- BUI `Checkbox` (`isSelected` / `onChange` / `isDisabled`, visually
  hidden input, label-click driven) is used in `DuplicateBoardDialog`
  and `ChecklistEditor`. BUI wraps react-aria-components (a direct
  dependency, `react-aria-components ^1.17`), whose Checkbox supports
  `isIndeterminate` for the header tri-state.
- Menu checkmark convention is a literal `✓ ` label prefix
  (`ItemMenu.tsx`: `mark`, priority submenu; `ItemFilterBar.tsx`).
  Toolbars are `Flex` rows of small tertiary buttons and `MenuTrigger`s
  (`ItemFilterBar.tsx`).
- Mutations: `useBoardActions` (`useBoardActions.ts`) wraps
  `boardsApi.moveItem` / `updateItem` / `deleteItem` with
  `guarded(...)` = run + `invalidateBoard` + error surfacing. Status is
  `columnId` and changes via `moveItem`, not `updateItem`; archive is
  `deleteItem`. There is **no bulk endpoint**, and every `guarded` call
  invalidates the board once.
- "Me" comes from `identityApiRef` via the cached
  `queryKeys.identity` query (`ItemMenu.tsx:61-67`); the assignee pool
  is `assigneePool(items)` and display names come from `useProfiles` +
  `refDisplayName`. Quick due dates are `todayISO` / `tomorrowISO` /
  `fridayISO` from `DueDate.tsx`.
- Read-only: `readonly = !canWrite || !!item.externalManager`; the
  backend rejects user mutations of externally managed items.

## Goals / Non-Goals

**Goals:**

- Id-based row selection in the board table that survives group-by
  changes and treats a multi-group item as one selection.
- A bulk-actions bar (status, priority, assignee, due date, archive)
  with ✓ / – state markers, driven entirely by existing single-item
  API calls with one board refresh per bulk action.

**Non-Goals:**

- No selection in the board (kanban) view, the my-items page, or any
  other table; no persistence of the selection across a switch to the
  board view and back (that unmounts `TableView`), across reloads, or
  in the URL.
- No new backend endpoint, action, or permission — fan-out over the
  existing API is enough at board sizes; a transactional bulk endpoint
  can come later without changing the UI contract.
- No shift-click range selection, no keyboard marquee; plain checkbox
  toggling only.
- No due-date state markers (✓/–) — the quick menu sets values, it does
  not report them, matching the card menu.

## Decisions

### 1. Selection is a `Set<string>` of item ids in `TableView`

`const [selected, setSelected] = useState<ReadonlySet<string>>(...)`
sits next to the existing `sort` state. Because rows are keyed by item
id and grouping only partitions the same `items` array, one set gives
"one item = one selection" across duplicate group rows for free, and a
group-by change re-partitions rows without touching the set. All
consumers derive `selectedItems = items.filter(i => selected.has(i.id))`
— items that vanish (archived elsewhere, filtered out, removed) drop
out of every computation without explicit pruning; the set is only
written on user interaction (toggle, select-all, clear, and a clear
after bulk archive).

*Alternative considered:* selection state in `BoardPage` (like
`groupBy`). Rejected — nothing outside the table view needs it, and
`TableView` already holds view-local state (`sort`); keeping it local
also guarantees the filter bar and drawer are unaffected.

### 2. An explicit checkbox column, not RAC `selectionMode`

`ItemsTable` gets a leading `<Column>` whose cells render a BUI
`Checkbox` (`isSelected={selected.has(item.id)}`, `onChange` toggles
the id, `isDisabled={!!item.externalManager}`, an `aria-label` naming
the item), and whose header renders the group's select-all checkbox.
React-aria's `selectionMode` is per-`TableRoot`, and the grouped view
renders N independent `TableRoot`s that must share one id-based
selection; explicit checkboxes make the shared state trivial, keep the
existing whole-row `onRowAction` (open drawer) untouched — RAC does not
fire the row action for clicks on interactive children — and follow the
`DuplicateBoardDialog` checkbox idiom. The column is rendered only when
`canWrite`; readers get exactly today's table.

The select-all checkbox covers the rows of *its* table (the group):
checked when every selectable (non-external) row is selected,
indeterminate when some are, and toggles between "add all selectable
row ids" and "remove all this group's row ids". BUI's `Checkbox` may
not forward `isIndeterminate`; if it does not, the header checkbox uses
`react-aria-components`' `Checkbox` directly (already a dependency)
with minimal styling.

### 3. One `BulkActionsBar` component above the tables

`TableView` renders `<BulkActionsBar/>` before the table(s) whenever
`canWrite && selectedItems.length > 0` — mount/unmount, not hide, so
"shown only when at least one item is selected" is structural. It is an
`ItemFilterBar`-style `Flex` row: a `Text` with `{n} selected`, a
tertiary "Clear" button (empties the set), four `MenuTrigger` dropdowns
(Status, Priority — only when `board.priorities.length > 0` —,
Assignee, Due date) and a danger-colored `Archive` button. Props:
`board`, `selectedItems`, `assigneePool`, the bulk handlers, and
`onClear`.

State markers extend the `ItemMenu` convention: label prefix `✓ ` when
**all** selected items match, `– ` (en dash) when **some** do, plain
label otherwise, computed per entry:

- Status: match = `item.columnId === column.id`; all columns listed
  (including the current one, unlike the single-item menu — it carries
  the ✓).
- Priority: match = `item.priorityId === priority.id`, listed in board
  `order`; "No priority" entry with match = `!item.priorityId`.
- Assignee: "Me" (`meRef` from the cached identity query) first, then
  `assigneePool` minus `meRef` sorted by `useProfiles` display name
  (same derivation as `ItemMenu`), then "No assignee"; match =
  `item.assignees.includes(ref)`, and for "No assignee" match =
  `item.assignees.length === 0`.

Selecting an entry applies: status → move every selected item to that
column; priority → set/clear `priorityId` on every item; assignee →
toggle semantics (all have it ⇒ remove from all, otherwise add to the
ones missing it), "No assignee" ⇒ `assignees: []` for items that have
any; due date → `todayISO()` / `tomorrowISO()` / `fridayISO()` /
`null` for every item. No-op updates (item already has the target
value) are skipped client-side to avoid needless PATCHes and history
noise.

*Alternative considered:* reusing `ItemMenu` with a synthetic "multi
item". Rejected — its actions, readonly logic, and labels are per-item;
the mixed-state (dash) rendering and toggle-all semantics don't fit.

### 4. Bulk fan-out in `useBoardActions`, one refresh per action

`BoardActionsHandle` grows a `bulk` handle passed to `TableView`:

```ts
interface BulkActions {
  moveItems(itemIds: string[], columnId: string): Promise<void>;
  updateItems(entries: { itemId: string; update: ItemUpdate }[]): Promise<void>;
  archiveItems(itemIds: string[]): Promise<void>;
}
```

Each method runs its per-item `boardsApi` calls with
`Promise.allSettled`, then a single `invalidateBoard`, and surfaces the
first rejection via the existing `setError` (same message style as
`guarded`). `updateItems` takes per-item updates because the assignee
toggle produces a different `assignees` array per item. Successful
items stick even when others fail — the settled fan-out plus one
invalidation shows the true resulting state. After `archiveItems` resolves, `TableView` drops the archived ids from
the set; per Decision 1 the derived intersection already hides rows
that disappeared, and ids whose archive call failed stay selected for
an easy retry.

*Alternative considered:* looping the existing per-item `actions.*`
(each `guarded`). Rejected — N invalidations and N sequential
refreshes; also `moveItem` is optimistic with per-call cache surgery
that isn't needed under a fan-out + single refresh.

*Alternative considered:* a new `POST /boards/:id/items/bulk` endpoint.
Rejected for now — boards are small (single-page tables), the change
log and notifications already hang off the single-item service methods,
and the UI contract wouldn't change if an endpoint is added later.

## Risks / Trade-offs

- **Partial failure leaves a mixed state** → `allSettled` + one
  invalidation renders the actual server state, the error banner names
  the failure, and the remaining selection makes retrying the failed
  items easy.
- **BUI `Checkbox` may not expose `isIndeterminate`** → fall back to
  `react-aria-components` `Checkbox` for the header cell (already a
  dependency BUI itself uses).
- **A checkbox click could also trigger the row action (open drawer)**
  → RAC suppresses row actions on interactive descendants; the test
  asserting "toggling a checkbox does not open the drawer" pins this
  down, and `stopPropagation` on the cell is the escape hatch.
- **Many parallel PATCHes hit the backend at once** → board tables are
  at most a few dozen rows; each call is independent and idempotent-ish
  (last write wins per item), and `allSettled` keeps one slow call from
  blocking the refresh of the rest.
- **The board-table e2e screenshot could change** → the checkbox column
  renders only for writers with nothing selected showing no bar; if the
  snapshot diff trips, it is regenerated once alongside the change.

## Open Questions

None.

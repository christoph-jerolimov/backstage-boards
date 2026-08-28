## Context

See `proposal.md` — Why. What shapes the approach is that half of this
already exists as of `board-item-priorities` and `priority-matrix-counts`:

- `PriorityMatrixDialog.tsx` renders a plain `<table>` of counts with
  `ToggleBadge` headers, keeps the *unselected* keys in two `Set<string>`
  so the default is everything selected, and computes `rowSum`,
  `columnSum` and `total` over the selected combinations only — an
  unselected axis reads 0 in its own sum too
  (`PriorityMatrixDialog.tsx:97-117`). Its rows are described by a small
  `MatrixRow` record: `{ key, name, color, matches(item) }`.
- `BoardDialogs` already takes `items: BoardItem[]` — "the board's items
  after the active filters, for the matrix" — and `BoardPage` fills it
  from `filter.filteredItems`, the same list the board and table views
  render (`BoardPage.tsx:106-123`).
- `groupItems(items, 'assignee')` defines the row semantics: an item
  lands in each of its assignees' groups, an item with no assignee lands
  in `UNASSIGNED`, groups sort by ref and the rest group is last
  (`grouping.ts`). `REST_LABEL.assignee` is the string "Unassigned".
- `useProfiles(refs)` batch-resolves catalog display names and pictures,
  and `ItemFilterBar` labels its assignee options with
  `profiles.get(ref)?.displayName ?? refDisplayName(ref)` — the wording
  the new rows should match.

## Goals / Non-Goals

**Goals:**

- One implementation of "matrix of counts with excludable axes", so the
  priority and assignee dialogs cannot disagree about what a sum means.
- The same assignee identity, ordering, and labelling the board already
  uses, so the matrix rows and the assignee swimlanes and the assignee
  filter never disagree about who exists.
- Reading the matrix and excluding a row or column costs no request.

**Non-Goals:**

- A backend aggregation endpoint. The items are already in the browser;
  a server-side matrix would add an endpoint, a permission path, and a
  second definition of the counting rule.
- Changing the priority matrix's behavior, wording, or gating. The
  extraction is a refactor; its spec stands as written.
- Cross-board or historical statistics, burndown, or any chart, and
  making cells actionable (drilling into the items behind a cell,
  assigning from the matrix). The dialog is read-only.
- Persisting the selection across opens, per user or per board.

## Decisions

**Extract `MatrixTable` from `PriorityMatrixDialog` and build both
dialogs on it, rather than copying the table into a second file.**
The sum arithmetic is the whole feature and it is subtle in exactly one
place — an unselected axis contributes nothing, *including to its own sum
cell*. Two copies would drift on the first change to that rule. The
shared component keeps the existing `MatrixRow` shape
(`{ key, name/label, color?, matches }`), takes the board's columns, the
items, and the aria label, and owns the two unselected sets; each dialog
supplies only its rows and its caption. `PriorityMatrixDialog` shrinks to
its row derivation and keeps its current markup, so its tests keep
passing unchanged — the check that the refactor was behavior-preserving.

**Rows come from `groupItems(items, 'assignee')`, not from a fresh pass
over `item.assignees`.**
Reusing it means the matrix cannot drift from group-by-assignee on the
questions both must answer: which refs exist, that a multi-assignee item
is in each group, that the unassigned group is last, and how the rest
sort. Each group's key becomes the row key and its `matches` is
`item.assignees.includes(ref)` (`item.assignees.length === 0` for the
`UNASSIGNED` row), so the counts stay a property of the item rather than
of the grouping's bookkeeping.

**Show the "Unassigned" row only when unassigned items exist**, exactly
as the priority matrix shows "No priority" only then. It falls out of
using `groupItems`, which emits the rest group only when it is non-empty,
and it keeps a board where everything is assigned from carrying a row of
zeros. Assignee rows likewise come from the items, not from the catalog:
a person with nothing on this board is not a row.

**Label assignee rows with the resolved display name inside the toggle,
never with an entity link.**
`RefDisplay` renders an `EntityRefLink`, and a link inside a toggle
button would give one header two conflicting activations. The row header
therefore renders `profiles.get(ref)?.displayName ?? refDisplayName(ref)`
as plain text in the same `ToggleBadge` the statuses use — matching how
`ItemFilterBar` labels the same people — with the ref as the button's
`title` so the full identity stays reachable. `text:` refs need no
lookup and read as their text.

**Keep an unselected axis at 0 in its own sum cell**, as the priority
matrix already does, rather than dimming a still-computed total. It is
the established reading of this table on this board ("the sums show what
you selected"), and one rule in one shared component beats two dialogs
that each need explaining.

**Two menu entries, not one dialog with a row-axis switch.**
A switch would keep the menu shorter, but the priority matrix is offered
only on boards that define priorities while the assignee matrix applies
to every board — a shared entry would have to change its meaning based on
the board, and the entry that opens "a matrix" tells the user less than
the entry that opens the matrix they want. So `BoardDialogKind` gains
`assigneeMatrix` and its existing `matrix` is renamed `priorityMatrix`,
which keeps the union readable now that there are two.

**The double count is stated in the dialog, not engineered away.**
Counting a shared item as a fraction, or only under its first assignee,
would misreport every individual's load — the number the matrix exists to
give. So the caption says items with several assignees are counted for
each of them, and a test pins the example (one item, two assignees, total
2).

## Risks / Trade-offs

- **The refactor touches shipped behavior** → `PriorityMatrixDialog`'s
  existing tests are the contract, and they run unchanged against the
  extracted component; the task list keeps the extraction and the new
  dialog as separate steps so a regression is attributable.
- **A wide board makes a wide table** (one column per status plus the
  sum) → the shared component keeps the existing `overflowX: 'auto'`
  wrapper and the row header stays first, so the row being read is always
  identified. Boards with a dozen statuses are already awkward in the
  kanban view for the same reason.
- **The overall total exceeding the item count is surprising** if the
  matrix is read as a partition → stated in the caption and pinned by a
  test. Unlike the priority matrix, where every item sits in exactly one
  row, this matrix genuinely double counts.
- **A board with many distinct assignees makes a tall table** → rows are
  bounded by the people actually on the board's filtered items, and the
  assignee filter narrows the matrix like every other view. Not paged.
- **Numbers depend on the active filter**, so a screenshot is not
  self-explanatory → inherited from the priority matrix, whose spec
  already requires respecting the filters; consistency wins over a
  per-dialog exception.

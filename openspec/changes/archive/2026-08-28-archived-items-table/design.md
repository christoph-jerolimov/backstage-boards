# Design

## Context

See `proposal.md` — Why. What shapes the approach:

- `ArchivedItemsDialog` renders each archived item as a `Flex` row: the
  title stacked over a sentence (`archived <date> by <ref>`), with a
  Restore `Button` pushed to the right by `justify="between"`.
- `RecentChangesDialog` is the precedent for a table inside a dialog:
  `TableRoot` / `TableHeader` / `Column` / `TableBody` / `Row` / `Cell`
  from `@backstage/ui`, with the loading and empty states rendered as
  plain `Text` *instead of* the table.
- `TableView` is the precedent for an interactive control in a cell — it
  puts `RowActionsMenu` in a trailing `Actions` column.
- Data is unchanged: `listArchivedItems` returns `BoardItem`s carrying
  `title`, `archivedAt`, and `archivedBy`; `useAsyncData` already gives
  `loading` and `refresh`, and the gating on `isOpen && canWrite` stays.

## Goals / Non-Goals

**Goals:**

- Present archived items in aligned columns, using the same BUI table
  primitives and the same structure as `RecentChangesDialog`.
- Keep restore working exactly as today, including the refresh of both
  the dialog's list and the board.

**Non-Goals:**

- No sorting, filtering, paging, or selection. The list is short-lived
  (30-day window) and the API returns it in one shot.
- No row action / row click behaviour. Unlike the recent-changes and
  board tables, an archived item has nothing to open — the only
  interaction is Restore.
- No bulk restore, no "purge now", no change to what the API returns.

## Decisions

### 1. Four columns: Title, Archived by, Archived, Actions

`Title` is the `isRowHeader` column, mirroring `Item` in
`RecentChangesDialog` and `Title` in `TableView`. The sentence that
today reads `archived <date> by <ref>` splits into two columns:
`Archived by` renders `RefDisplay` and `Archived` renders
`formatDate(item.archivedAt)`. `Actions` holds the Restore button, the
same trailing-column placement `TableView` uses for its row menu.

`archivedAt` and `archivedBy` are optional on `BoardItem`, so both cells
keep the existing fallback to empty content rather than rendering
`undefined`.

*Alternative considered:* one combined `Archived` column keeping the
sentence. Rejected — it reproduces the alignment problem the change
exists to fix.

### 2. No `onRowAction`

`RecentChangesDialog` passes `onRowAction` because every row has a
natural target. Here the row's only action is a button inside a cell;
wiring `onRowAction` to restore would make an accidental row click
destructive-adjacent and would fight the button's own press handling.
The table therefore gets `aria-label="Archived items"` and no row action.

### 3. The Restore button keeps its visible label and behaviour

The button stays `variant="secondary" size="small"` with the text
`Restore` and the same async handler (`restoreItem` → `refresh` →
`onChanged`). Inside a table, the row header cell supplies the row
context that the label alone would otherwise lack, so no per-row
`aria-label` is added — which also keeps the existing
`getByRole('button', { name: 'Restore' })` test lookups meaningful.

### 4. The purge note and the non-table states stay outside the table

The `Archived items are removed permanently after 30 days.` note remains
a `Text` above the table, so the two stay in a `Flex direction="column"`
wrapper. `Loading…` and `No archived items.` continue to replace the
whole content, as in both existing dialogs — an empty table body would
show a header for rows that do not exist.

## Risks / Trade-offs

- **A long title plus four columns can crowd a narrow dialog** → the
  same trade-off `RecentChangesDialog` already makes with its four
  columns; the dialog's own width handling is unchanged, so no new
  layout code is introduced here.
- **Existing tests query by visible text** (`Old task`, the ref link,
  the purge note) → all of those still render, so the test changes are
  additive (asserting the column headers) rather than a rewrite.

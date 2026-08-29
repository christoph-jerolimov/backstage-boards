## Context

All four tables use BUI's `TableRoot/TableHeader/Column/Row/Cell` (React Aria under the hood, plain HTML table layout — no `ResizableTableContainer`):

- `TableView.tsx:77` — `<Column>Actions</Column>`, cell holds `rowMenu.rowActions(item)` (three-dot `ButtonIcon`).
- `MyItemsPage.tsx:179` — same pattern.
- `BoardListPage.tsx:101-105` — leading `<Column>Favorite</Column>` (a `FavoriteButton` star) plus `<Column>Actions</Column>`.
- `ArchivedItemsDialog.tsx:61` — `<Column>Actions</Column>`, cell holds a "Restore" button.

React Aria's `Column` accepts `aria-label` (required when it has no children) and passes `style` through to the `<th>`; in an auto-layout table a `width: 0` header collapses the column to its content's minimum width. `Column` elements must stay direct JSX children of `TableHeader` (React Aria's collection traversal), so the shared bit is a props/style constant plus a cell-content wrapper — not a wrapper around `Column` itself.

## Goals / Non-Goals

**Goals:**
- Utility columns (favorite, actions) as narrow as their control, no visible header text, still accessibly labelled.
- Actions control right-aligned against the table edge.

**Non-Goals:**
- No changes to data columns, sorting, row actions, or menus.
- No table restructuring; the archived dialog's "Restore" button keeps its wording.

## Decisions

- Add to `RowMenu.tsx` (where the row-menu plumbing already lives):
  - `export const utilityColumnStyle = { width: 0 } as const;` — applied via `style` on each utility `Column`, letting the auto table layout shrink it to content.
  - `export function ActionsCellContent({ children })` — a `display: flex; justify-content: flex-end` div wrapped around the actions cell's content, so the button hugs the right edge whatever width the browser settles on.
- Each utility column becomes `<Column aria-label="Actions" style={utilityColumnStyle} />` (respectively `aria-label="Favorite"`); the favorite cell needs no alignment wrapper (leading column, left-aligned is right).
- Alternative considered: React Aria `width`/`defaultWidth` props — rejected, they only apply inside `ResizableTableContainer`, which none of these tables use.
- Tests asserting header text lists change from `['…', 'Actions']` to `['…', '']` (the header cell renders empty) — assert the accessible name via `getByRole('columnheader', { name: 'Actions' })` instead where useful.

## Risks / Trade-offs

- [`width: 0` relies on auto table layout minimum-content sizing] → all four tables use the default layout; verified visually and by screenshot regen.
- [Header-text assertions in `ArchivedItemsDialog.test.tsx` and `MyItemsPage.test.tsx` break] → update them alongside the change.
- [`board-table` and `my-items` screenshot baselines change] → regenerate light and dark; kanban/drawer/settings/matrix/home show no tables and stay untouched (the board list page has no screenshot test).

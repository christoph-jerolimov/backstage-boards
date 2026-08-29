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
  - `export const utilityColumnStyle = { width: 56 } as const;` — BUI tables render with `table-layout: fixed; width: 100%`, so utility columns need an explicit small width (a zero/auto width clips the content entirely under fixed layout — caught by the functional e2e run). 56px = the small icon button plus the cell padding, mirroring the library's own 40px selection-column width. The archived dialog's column holds a text "Restore" button and gets `width: 112` instead.
  - `export function ActionsCellContent({ children })` — a `display: flex; justify-content: flex-end` div wrapped around the actions cell's content, so the button hugs the right edge whatever width the browser settles on.
- Each utility column becomes `<Column style={utilityColumnStyle}><VisuallyHidden>Actions</VisuallyHidden></Column>` (respectively "Favorite"); the favorite cell needs no alignment wrapper (leading column, left-aligned is right). React Aria's `Column` turned out to drop `aria-label` from the rendered `<th>` (verified in a scratch render), so the accessible name comes from visually hidden text (`react-aria`'s `VisuallyHidden`) instead — which also keeps the header's `textContent`, so the existing header-text test assertions hold unchanged.
- Alternative considered: React Aria `width`/`defaultWidth` props — rejected, they only apply inside `ResizableTableContainer`, which none of these tables use.
- First attempt `width: 0` (auto-layout min-content sizing) failed in the real browser: BUI's fixed table layout honors the zero literally and clips the buttons; unit tests (jsdom, no CSS) could not catch it — the functional Playwright run did.
- Tests asserting header text lists stay valid: the visually hidden label keeps 'Actions'/'Favorite' in the header's text content.

## Risks / Trade-offs

- [Fixed widths must fit their control across themes/zoom] → 56px carries ~28px of slack over the icon button; verified visually in the live app and by screenshot regen.
- [Header-text assertions in `ArchivedItemsDialog.test.tsx` and `MyItemsPage.test.tsx` break] → not needed after all; the visually hidden label preserves the asserted text.
- [`board-table` and `my-items` screenshot baselines change] → regenerate light and dark; kanban/drawer/settings/matrix/home show no tables and stay untouched (the board list page has no screenshot test).

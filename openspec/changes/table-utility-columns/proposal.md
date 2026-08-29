## Why

Every table gives its utility columns the same treatment as data columns: the board list's leading favorite-star column and the trailing actions column carry visible "Favorite"/"Actions" titles and get a data column's share of the width, so a single star or three-dot button floats in a wide, labelled column. These columns should read as quiet controls, not data.

## What Changes

- The favorite column (board list) and the actions columns (board table view, my-items listing, board list, archived-items dialog) shrink to the width of their control — the star, the three-dot menu button, or the restore button.
- Their column headers lose the visible title; the column keeps an accessible label (`aria-label`) so screen readers still announce it.
- The actions control is right-aligned in its cell, hugging the table's edge.
- No behavior changes: the same buttons, menus, and interactions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — purely presentational (`skip_specs: true`); the my-items spec's requirement that the last column is an actions column with a menu button is untouched behaviorally.

## Impact

- `plugins/boards/src/components/RowMenu.tsx` — small shared helpers (utility-column style, right-aligned cell wrapper).
- `plugins/boards/src/components/TableView.tsx`, `MyItemsPage.tsx`, `BoardListPage.tsx`, `ArchivedItemsDialog.tsx` — column/cell adjustments.
- Unit tests asserting column header texts (`ArchivedItemsDialog.test.tsx`, `MyItemsPage.test.tsx`) need their expected header lists updated (accessible names remain via `aria-label`).
- Screenshot baselines: `board-table` and `my-items` (light and dark) must be regenerated.

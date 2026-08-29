## Why

The board table shows a fixed set of columns — Title, Status, Priority, Due, Assignees, Tags, Created by, Updated — with no way to tailor it. The audit columns crowd the table for users who never look at them, while Created and Updated by aren't available at all for users who do.

## What Changes

- Two new columns: **Created** (creation time) and **Updated by**, both sortable, joining the existing sortable audit columns.
- **Default visibility changes**: only Title, Status, Priority, Due, Assignees, and Tags are shown out of the box; Created by and Updated become opt-in.
- A **small dropdown menu** on the table view lets the user show/hide each column. Title is always shown (it is the row header); the trailing actions column is a control, not a data column, and is not offered.
- The visible-column choice is **saved per user and per board** through the Backstage user settings storage (`storageApiRef`, as the drawer drafts already do), so it survives reloads, follows the user across devices, and different boards keep independent choices.
- The priority column keeps its existing feature rules: it renders only when the board actually uses priorities, now additionally subject to the user's visibility choice.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: new requirement "Configurable board table columns" (available columns, defaults, dropdown, per-user/per-board persistence); the "Table sorting" requirement extends to the new Created and Updated by columns (and names the already-sortable Due column).
- `boards/item-priorities`: the "Priority display" requirement's board-table sentence gains the visibility condition — the column shows only when used *and* not hidden by the user.

## Impact

- `plugins/boards/src/components/TableView.tsx` — column definition list, visibility filtering, the configure-columns dropdown, the two new columns.
- `plugins/boards/src/components/grouping.ts` — `ITEM_SORT_COLUMNS`/`sortItems` gain `createdAt` and `updatedBy`.
- New `useVisibleColumns` persistence hook beside the existing `drafts.ts` pattern (storage bucket keyed by board id).
- Tests: `TableView.test.tsx` rework (default header set changes, toggle + persistence cases with `mockApis.storage`).
- Screenshot baselines: `board-table` (light and dark) — the default view loses the Created by and Updated columns.
- No backend/API changes.

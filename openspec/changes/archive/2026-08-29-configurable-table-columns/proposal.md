## Why

The board table shows a fixed set of columns — Title, Status, Priority, Due, Assignees, Tags, Created by, Updated — with no way to tailor it. The audit columns crowd the table for users who never look at them, while Created and Updated by aren't available at all for users who do.

## What Changes

- Two new columns: **Created** (creation time) and **Updated by**, both sortable, joining the existing sortable audit columns.
- **Default visibility changes**: only Title, Status, Priority, Due, Assignees, and Tags are shown out of the box; Created by and Updated become opt-in.
- A **small dropdown menu** on the table view lets the user show/hide each column. Title is always shown (it is the row header); the trailing actions column is a control, not a data column, and is not offered.
- The visible-column choice is **saved per user and per board** through the Backstage user settings storage (`storageApiRef`, as the drawer drafts already do), so it survives reloads, follows the user across devices, and different boards keep independent choices.
- The priority column keeps its existing feature rules: it renders only when the board actually uses priorities, now additionally subject to the user's visibility choice.
- **The my-items listing gets the same treatment**: the same data columns (with "Item" as its always-shown title column), the same defaults — which adds an Assignees column to today's my-items view — and its own configure-columns dropdown. Its choice is stored per user for the listing as a whole (it spans boards); the conditional Board column stays governed by the grouping, outside the menu. The my-items tables keep having no header sorting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: new requirement "Configurable item table columns" covering the board table and the my-items listing (available columns, defaults, the menu, title column never hideable, actions column not offered, per-user persistence — per board for board tables, one setting for the my-items listing); the "Table sorting" requirement extends to the new Created and Updated by columns (and names the already-sortable Due column); the "My items sub-page" requirement's field list becomes the default column set, subject to the column menu.
- `boards/item-priorities`: the "Priority display" requirement's board-table and my-items sentences gain the visibility condition — the column shows only when used *and* not hidden by the user.

## Impact

- `plugins/boards/src/components/TableView.tsx` — column definition list, visibility filtering, the configure-columns dropdown, the two new columns.
- `plugins/boards/src/components/grouping.ts` — `ITEM_SORT_COLUMNS`/`sortItems` gain `createdAt` and `updatedBy`.
- New `useVisibleColumns` persistence hook beside the existing `drafts.ts` pattern (storage bucket keyed by board id).
- `plugins/boards/src/components/MyItemsPage.tsx` — same column model and dropdown for the listing (shared `ColumnsMenu` component).
- Tests: `TableView.test.tsx` and `MyItemsPage.test.tsx` rework (default header sets change, toggle + persistence cases with `mockApis.storage`).
- Screenshot baselines: `board-table` and `my-items` (light and dark) — the defaults change on both.
- No backend/API changes.

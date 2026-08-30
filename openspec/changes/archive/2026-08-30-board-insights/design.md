## Context

Every item mutation is recorded in the `changes` table; status moves
carry `type='moved', field='status'` with the old/new column *titles*
(not ids) and a timestamp, and item creation carries `type='created'`.
Items know their current column, `created_at`, and `archived_at`. The
board page already has a two-mode view toggle (`ALL_BOARD_VIEW_MODES`)
and matrix dialogs reachable from the board menu (`BoardDialogs` with
`assignee-matrix` / `priority-matrix` kinds). The plugin has no chart
dependency.

## Goals / Non-Goals

**Goals:**
- Modest, dependency-free analytics computed server-side in one pass.
- Reuse: view toggle, matrix dialogs, column colors, EmptyState.

**Non-Goals:**
- No per-item drill-down, no custom date ranges, no exports.
- No new history storage: derived purely from existing records.

## Decisions

- **History reconstruction by column title**: moves store titles, so
  each item's interval list is rebuilt by walking its moves forward
  from `created_at`; the initial column is derived by walking
  backwards from the current column through the moves. Titles are
  mapped to current columns by title; intervals whose title no longer
  resolves (renamed columns) are dropped from per-column charts. This
  is an accepted approximation, noted in the docs.
- **Windows fixed**: 30 days CFD, 8 ISO weeks throughput; cycle time
  uses all completed stays. Simple, cache-friendly, no query params.
- **Server-side aggregation** in `BoardsService.getBoardInsights`:
  one query for the board's moves ordered by time, one for items
  (including archived, for their history). Response type
  `BoardInsights` in `boards-common`.
- **Charts as inline SVGs** with fixed viewBox and theme tokens
  (`--bui-fg-*`, column colors via the existing palette): a horizontal
  bar chart (cycle time), a stacked area (CFD), and a weekly bar chart
  (throughput).
- **Insights is a view mode**, not a route: `ALL_BOARD_VIEW_MODES`
  gains `'insights'`; the filter bar and bulk bar stay hidden in that
  mode since they act on the item views. Matrix dialogs open through
  the existing `BoardDialogs` plumbing.

## Risks / Trade-offs

- Title-based reconstruction misattributes history across column
  renames; acceptable for trend-level insight, documented.
- Boards with very long histories recompute on each request; fine at
  this scale (single board, indexed by board_id).

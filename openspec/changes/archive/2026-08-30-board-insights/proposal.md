## Why

Boards accumulate a full move history, but there is no way to see how
work actually flows: where items pile up, how long they sit per column,
how much gets done per week. A modest Insights view answers those
questions with the data the board already records.

## What Changes

- A third **Insights** view on the board page, next to the kanban and
  table toggles, showing:
  - **Cycle time per column** — average and median time items spend in
    each column, from the recorded status moves.
  - **Cumulative flow** — a stacked area of item counts per column per
    day over the last 30 days, reconstructed from the move history.
  - **Throughput** — items that reached the board's last column per
    week over the last 8 weeks.
- Aggregates are computed server-side by a new
  `GET /boards/:boardId/insights` endpoint (read access).
- The Insights view links to the existing assignee and priority matrix
  dialogs for the people/priority breakdowns.
- Charts are dependency-free inline SVGs, theme-aware.

## Capabilities

### New Capabilities

- `boards/insights`: board flow analytics — the insights endpoint and
  the Insights view with its three charts.

### Modified Capabilities

None.

## Impact

- `plugins/boards-backend` — insights computation over the `changes`
  table and items; one route.
- `plugins/boards-common` — `BoardInsights` types.
- `plugins/boards` — view mode, `InsightsView` component with SVG
  charts, API client method.
- Docs: README + a new `docs/features/insights.md`.

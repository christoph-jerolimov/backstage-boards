## 1. Backend

- [x] 1.1 Add `BoardInsights` types to boards-common and implement
      `getBoardInsights` (interval reconstruction, cycle time, CFD,
      throughput); verify with service tests covering the spec
      scenarios and an empty board.
- [x] 1.2 Route `GET /boards/:boardId/insights` (read access) and the
      frontend client method; verify with a router test.

## 2. Frontend

- [x] 2.1 Add the `insights` view mode with its toggle; verify the
      header test still passes and the mode round-trips.
- [x] 2.2 Implement `InsightsView` with the three SVG charts, matrix
      dialog entry points, and the empty state; verify with component
      tests (chart presence from fixture data, empty state, dialog
      opening).

## 3. Docs

- [x] 3.1 Add `docs/features/insights.md`, link it from mkdocs and
      README, and verify wording matches behavior.

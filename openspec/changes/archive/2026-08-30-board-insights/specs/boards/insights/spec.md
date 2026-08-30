## Purpose
Board flow analytics: server-computed cycle time, cumulative flow, and
throughput derived from the board's recorded item history, shown in an
Insights view on the board page.

## ADDED Requirements

### Requirement: Insights endpoint
The API SHALL provide a board insights endpoint requiring read access
that returns server-computed aggregates derived from the board's items
and recorded status moves: per-column cycle time (average and median
duration of completed stays, with the number of stays measured),
cumulative flow (per-day item counts per column over the last 30 days),
and throughput (per-week count of items entering the board's last
column over the last 8 weeks). Archived items SHALL stop counting in
the cumulative flow from their archival, while their completed stays
still contribute to cycle time. A board with no history SHALL yield
empty aggregates rather than an error.

#### Scenario: Cycle time from move history
- **WHEN** an item was created in "Todo", moved to "Doing" two days
  later, and to "Done" three days after that
- **THEN** the insights report a completed stay of two days in "Todo"
  and three days in "Doing"

#### Scenario: Throughput counts arrivals in the last column
- **WHEN** three items moved into the board's last column this week and
  one the week before
- **THEN** the throughput series reports 3 for this week and 1 for the
  previous week

#### Scenario: Read access suffices
- **WHEN** a user with read-only access requests the insights
- **THEN** the aggregates are returned

### Requirement: Insights view
The board page SHALL offer an Insights view as a third mode next to the
kanban and table toggles, rendering the endpoint's aggregates as three
charts — cycle time per column, cumulative flow, and throughput — using
the board's column colors where available, plus entry points to the
existing assignee and priority matrix dialogs. Empty aggregates SHALL
render an explanatory empty state. The view SHALL be available to
readers.

#### Scenario: Switching to Insights
- **WHEN** a user selects the Insights toggle on a board with history
- **THEN** the three charts render from the board's aggregates, and
  switching back to the kanban view restores the previous mode

#### Scenario: Matrices reachable from Insights
- **WHEN** a user opens the Insights view
- **THEN** the assignee matrix and priority matrix dialogs can be
  opened from it

#### Scenario: New board without history
- **WHEN** a user opens Insights on a board whose items never moved
- **THEN** an explanatory empty state appears instead of empty charts

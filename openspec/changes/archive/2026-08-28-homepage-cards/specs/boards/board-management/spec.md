# Board Management

## ADDED Requirements

### Requirement: Per-status item counts in board listings

The board listing SHALL support an opt-in mode that returns, for each
listed board, that board's columns together with the number of
non-archived items in each column. The counts SHALL be scoped exactly
like the listing itself: a board the caller cannot read contributes no
counts, and a column with no items is reported with a count of zero
rather than omitted. Requesting counts SHALL NOT change which boards the
listing returns.

When the mode is not requested, the listing SHALL be unchanged and SHALL
carry no counts, so existing callers pay nothing for the feature.

#### Scenario: Counts requested

- **WHEN** a user lists boards with counts requested, and one of their
  boards has three items in "Todo", one in "In Progress", and none in
  "Done"
- **THEN** that board's entry carries its three columns with counts 3, 1,
  and 0 respectively

#### Scenario: Archived items excluded from counts

- **WHEN** counts are requested and one item on a listed board is archived
- **THEN** the archived item is not included in its column's count

#### Scenario: Counts do not widen access

- **WHEN** a user lists boards with counts requested and a private board
  they cannot read exists
- **THEN** neither that board nor any count for it is returned

#### Scenario: Counts not requested

- **WHEN** a caller lists boards without requesting counts
- **THEN** the entries carry no counts and are otherwise identical to the
  listing as it was before this change

# Board Management

## ADDED Requirements

### Requirement: Duplicate copies items and entity references on request

Board duplication SHALL optionally copy the source board's non-archived
items — titles, positions, descriptions, due dates, assignees, labels,
and tags — into the corresponding copied columns. Copying items SHALL
require copying columns; a request to copy items without columns SHALL
be rejected. Comments, item history, watches, and external-manager
flags SHALL NOT be copied. Duplication SHALL also optionally copy the
board's entity reference list.

#### Scenario: Items copied with columns

- **WHEN** a board is duplicated with copy columns and copy items
- **THEN** each new column contains copies of the source column's
  active items with their fields and associations, and the copies have
  no comments or history beyond their creation

#### Scenario: Items require columns

- **WHEN** a duplicate request asks for items without columns
- **THEN** the request fails with an input error

#### Scenario: Entity references copied

- **WHEN** a board referencing two entities is duplicated with copy
  entity references
- **THEN** the copy references the same two entities

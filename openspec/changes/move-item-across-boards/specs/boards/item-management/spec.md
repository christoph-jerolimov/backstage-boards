## ADDED Requirements

### Requirement: Move an item to another board
Users with write access SHALL be able to move an item to another board
from the item menu: a dialog SHALL offer the boards the user can write
to (excluding the current board), load the selected board's columns,
require choosing one, and perform the move. The move SHALL atomically
create a new item on the target board in the chosen column — carrying
the title, description with its full version history, tags, assignees,
due date, and checklist with its checked state, and the original's
recorded change history and comments with their authors and
timestamps — and archive the original on the source board. The item's
priority SHALL carry over only when the target board has a priority of
the same name. The moved item's history SHALL additionally record the
move with the source board's name. The operation SHALL require write
access on both boards, SHALL honor the target column's hard WIP limit,
and SHALL reject externally managed items. The archived original SHALL
remain restorable like any archived item.

#### Scenario: Move with full history
- **WHEN** a writer moves an item with two comments and several
  recorded changes to another board's "Todo" column
- **THEN** the target board shows the item in "Todo" with its fields,
  comments, and history preserved plus a move record naming the source
  board, and the source board lists the original under archived items

#### Scenario: Column list follows the board choice
- **WHEN** the user selects a target board in the move dialog
- **THEN** that board's columns are loaded and offered, and Move stays
  disabled until one is chosen

#### Scenario: Priority carries over by name
- **WHEN** an item with priority "high" moves to a board that also
  defines "high", and another item moves to a board without it
- **THEN** the first keeps "high" on the target board and the second
  arrives without a priority

#### Scenario: Write access on both sides
- **WHEN** the user lacks write access on the target board
- **THEN** the board is not offered, and a direct API call is rejected

#### Scenario: Hard WIP limit blocks the move
- **WHEN** the chosen target column is at its hard WIP limit
- **THEN** the move fails with a conflict error and nothing changes on
  either board

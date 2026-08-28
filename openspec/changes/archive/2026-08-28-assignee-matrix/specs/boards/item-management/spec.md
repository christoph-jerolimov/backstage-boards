# Item Management

## ADDED Requirements

### Requirement: Assignee and status matrix dialog

The board menu SHALL offer, on every board, a matrix dialog showing all
of the board's columns (statuses) as one axis and the assignees carrying
the board's items — ordered as the board's group-by-assignee grouping
orders its groups, plus a trailing "Unassigned" row when items without an
assignee exist — as the other. Each cell SHALL show the number of the
board's non-archived items that have that status and that assignee,
respecting the currently active filters; the items themselves SHALL NOT
be listed in the cells. An item with several assignees SHALL be counted
in each of their rows, so the overall total MAY exceed the number of
items, and the dialog SHALL say so.

The matrix SHALL carry a trailing sum column giving each assignee row's
total across the selected statuses, a trailing sum row giving each status
column's total across the selected assignees, and an overall total of the
selected combinations where sum row and sum column meet.

The status headers and the assignee headers SHALL be clickable and SHALL
toggle that status or assignee between selected and unselected;
everything SHALL start selected each time the dialog opens, and a toggle
SHALL be reversible. An unselected status or assignee SHALL be excluded
from the sum column, the sum row, and the overall total, and SHALL be
visibly marked as unselected; its cells' own counts SHALL remain visible.

Assignees SHALL be labelled by their resolved catalog display name,
falling back to the ref's own name, and free-text `text:` assignees by
their text — the same labelling the assignee filter uses. The dialog
SHALL NOT change any item.

#### Scenario: Matrix shows items per status and assignee

- **WHEN** a user opens the assignee matrix on a board with columns
  "Todo"/"Done" where Alice has two items in "Todo" and one in "Done"
- **THEN** Alice's Todo cell shows 2, her Done cell shows 1, and no item
  titles or buttons appear in any cell

#### Scenario: Sum row, sum column, and overall total

- **WHEN** the board has one Todo item assigned to Alice, one Done item
  assigned to Alice, and one Todo item assigned to Bob
- **THEN** Alice's row sums to 2, Bob's row to 1, the Todo column to 2,
  the Done column to 1, and the overall total shows 3

#### Scenario: An item with two assignees counts in both rows

- **WHEN** a single "Todo" item is assigned to both Alice and Bob
- **THEN** both Alice's and Bob's Todo cells show 1, the overall total
  shows 2, and the dialog states that items with several assignees are
  counted for each of them

#### Scenario: Items without an assignee

- **WHEN** the board has items with no assignee
- **THEN** the matrix shows their counts in a trailing "Unassigned" row
  under their status columns, and that row participates in sums and
  toggling like an assignee row

#### Scenario: Every assignee is assigned

- **WHEN** every item on the board has at least one assignee
- **THEN** the matrix shows no "Unassigned" row

#### Scenario: Unselecting a status excludes it from the sums

- **WHEN** the user clicks the "Done" status header in the matrix of the
  sum scenario
- **THEN** "Done" is marked unselected, Alice's row sum becomes 1, the
  Done column sum reflects no selected combinations, and the overall
  total shows 2
- **WHEN** the user clicks the "Done" header again
- **THEN** the sums return to their previous values

#### Scenario: Unselecting an assignee excludes them from the sums

- **WHEN** the user clicks Bob's row header
- **THEN** the Todo column sum and the overall total no longer count
  Bob's Todo item, while Bob's own cell counts stay visible

#### Scenario: Selection resets on reopen

- **WHEN** a user unselects a status, closes the matrix, and opens it
  again
- **THEN** every status and assignee is selected again

#### Scenario: Active filter narrows the matrix

- **WHEN** a search, tag, or assignee filter is active on the board and
  the user opens the matrix
- **THEN** only the items the board is currently showing are counted

#### Scenario: Read-only access

- **WHEN** a user with only read access opens the board's actions menu
- **THEN** the assignee matrix entry is offered, and opening it changes
  no item

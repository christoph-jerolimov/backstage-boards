# boards/item-priorities Specification (delta)

## MODIFIED Requirements

### Requirement: Status and priority matrix dialog

The board menu SHALL offer, on boards that define at least one priority, a matrix dialog showing all of the board's columns (statuses) as one axis and all its priorities — ordered by order number ascending, plus a "No priority" row when items without a priority exist — as the other. Each cell SHALL show the number of the board's non-archived items that have that status and that priority, respecting the currently active filters; the items themselves SHALL NOT be listed in the cells.

The matrix SHALL carry a trailing sum column giving each priority row's total across the selected statuses, a trailing sum row giving each status column's total across the selected priorities, and an overall total of the selected combinations where sum row and sum column meet.

The status headers and the priority headers SHALL be clickable badges that toggle that status or priority between selected and unselected; everything SHALL start selected, and a toggle SHALL be reversible. An unselected status or priority SHALL be excluded from the sum column, the sum row, and the overall total, and SHALL be visibly marked as unselected; its cells' own counts SHALL remain visible.

#### Scenario: Matrix shows items per status and priority

- **WHEN** a user opens the matrix dialog on a board with columns "Todo"/"Done" and priorities "critical"/"low", where two items are Todo+critical
- **THEN** the Todo × critical cell shows 2 and no item titles or buttons appear in any cell

#### Scenario: Sum row, sum column, and total

- **WHEN** the board has one Todo+critical item, one Done+critical item, and one Todo+low item
- **THEN** the critical row sums to 2, the low row to 1, the Todo column to 2, the Done column to 1, and the overall total shows 3

#### Scenario: Unselecting a status excludes it from the sums

- **WHEN** the user clicks the "Done" status badge in the matrix of the previous scenario
- **THEN** "Done" is marked unselected, the critical row sum becomes 1, the Done column sum reflects no selected combinations, and the overall total shows 2
- **WHEN** the user clicks the "Done" badge again
- **THEN** the sums return to their previous values

#### Scenario: Unselecting a priority excludes it from the sums

- **WHEN** the user clicks the "low" priority badge
- **THEN** the Todo column sum and the overall total no longer count the Todo+low item, while the low row's own cell counts stay visible

#### Scenario: Items without priority

- **WHEN** the board has items without a priority
- **THEN** the matrix shows their counts in a trailing "No priority" row under their status columns, and that row participates in sums and toggling like a priority row

#### Scenario: No matrix without priorities

- **WHEN** a board defines no priorities
- **THEN** the board menu offers no matrix dialog entry

# Board Management

## MODIFIED Requirements

### Requirement: Configurable columns per board
Each board SHALL have an ordered list of columns configurable from the UI by users with `admin` or `write` access. A column represents an item status; there SHALL be no built-in statuses (including no built-in "done" status) — all statuses come from the board's columns. Columns SHALL be creatable, renamable, reorderable, and deletable inline in the board view.

On a board that already has columns, creation SHALL be offered from each column's menu as "Insert column before" and "Insert column after", which place the new column immediately before or after the column whose menu was used. On a board with no columns, creation SHALL be offered as a standalone affordance in the empty board area. Both entry points SHALL take the new column's title inline in the board view, and SHALL create nothing if the user cancels or supplies an empty title.

#### Scenario: Add a column
- **WHEN** a user with write access adds a column named "In Review" to a board
- **THEN** the column appears at the chosen position in the board view and becomes a selectable status for items on that board

#### Scenario: Insert a column after another
- **WHEN** a user with write access chooses "Insert column after" on the "Todo" column of a board whose columns are "Todo" and "Done", and confirms the title "In Review"
- **THEN** the board's columns are "Todo", "In Review", "Done" in that order, and the new column is never shown at the end of the board on its way there

#### Scenario: Insert a column before the first one
- **WHEN** a user with write access chooses "Insert column before" on the leftmost column and confirms a title
- **THEN** the new column becomes the leftmost column of the board

#### Scenario: Cancelled insert creates nothing
- **WHEN** a user with write access opens an insert affordance and then cancels it or confirms an empty title
- **THEN** the board's columns are unchanged

#### Scenario: Read-only user has no insert entries
- **WHEN** a user with only read access opens a column's menu
- **THEN** no insert entries are offered and the column set cannot be changed

#### Scenario: Rename a column
- **WHEN** a user with write access renames a column
- **THEN** items in that column keep their association with the renamed column and display the new status name

#### Scenario: Delete a non-empty column
- **WHEN** a user with write access deletes a column that still contains items
- **THEN** the system requires the user to choose a target column for those items (or blocks deletion until the column is empty) so that no item is left without a status

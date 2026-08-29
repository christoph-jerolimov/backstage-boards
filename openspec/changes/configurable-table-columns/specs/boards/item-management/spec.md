# boards/item-management Specification (delta)

## ADDED Requirements

### Requirement: Configurable board table columns
The board table view SHALL offer these data columns: Title, Status, Priority, Due, Assignees, Tags, Created by, Created, Updated by, and Updated. By default only Title, Status, Priority, Due, Assignees, and Tags SHALL be visible. The table view SHALL offer a small dropdown menu from which the user can show and hide each column, marked with the current visibility; Title SHALL always be shown and SHALL NOT be offered for hiding, and the trailing actions column is a control rather than a data column and SHALL NOT be offered either. The Priority entry remains subject to the priority feature's own rules (no priority column on a board where no listed item has one).

The set of visible columns SHALL be stored per user and per board through the user settings storage, so it survives closing the page and reloading the browser and does not affect other users; each board SHALL keep its own choice.

#### Scenario: Default columns

- **WHEN** a user opens a board's table view for the first time
- **THEN** the table shows Title, Status, Priority (when used), Due, Assignees, and Tags — and no Created by, Created, Updated by, or Updated columns

#### Scenario: Show an audit column

- **WHEN** the user opens the column menu and enables "Created"
- **THEN** the table gains a Created column showing each item's creation time

#### Scenario: Hide a default column

- **WHEN** the user disables "Tags" in the column menu
- **THEN** the Tags column disappears from the table while the other columns stay

#### Scenario: Choice persists per user and board

- **WHEN** the user enables "Updated by" on board A and reloads the browser
- **THEN** board A's table still shows the Updated by column, while board B's table keeps its own column set and other users' views are unaffected

#### Scenario: Title cannot be hidden

- **WHEN** the user opens the column menu
- **THEN** no entry offers hiding the Title column and the table always renders it

## MODIFIED Requirements

### Requirement: Table sorting
The table view SHALL allow sorting by the Title, Status, Due, Created by, Created, Updated by, and Updated columns via their headers, toggling between ascending and descending. Sorting SHALL combine with active filters, and with group-by-assignee enabled it SHALL order the items within each group.

#### Scenario: Sort by title
- **WHEN** a user activates the Title header
- **THEN** rows order alphabetically by title, and activating it again reverses the order

#### Scenario: Sort by creation time
- **WHEN** the Created column is visible and the user activates its header
- **THEN** rows order by creation time, and activating it again reverses the order

#### Scenario: Sorting within groups
- **WHEN** group-by-assignee is active and a sort is applied
- **THEN** each assignee group's rows are ordered by the selected sort

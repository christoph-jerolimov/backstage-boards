## Purpose

Lets users create, discover, configure, and delete shareable boards with per-board configurable columns, favorites, and optional assignment to a catalog entity.

## ADDED Requirements

### Requirement: Create a board
The system SHALL allow an authenticated user to create a board with a name. The creating user SHALL automatically receive the `admin` permission level on the board. A new board SHALL start with a default set of columns that the creator can immediately change.

#### Scenario: User creates a board
- **WHEN** an authenticated user creates a board named "Team Alpha"
- **THEN** the board is persisted with the given name, the user is recorded as its creator with `admin` access, and the board appears in the user's board list

#### Scenario: Board creation requires a name
- **WHEN** a user attempts to create a board with an empty or whitespace-only name
- **THEN** the request is rejected with a validation error and no board is created

### Requirement: Configurable columns per board
Each board SHALL have an ordered list of columns configurable from the UI by users with `admin` or `write` access. A column represents an item status; there SHALL be no built-in statuses (including no built-in "done" status) — all statuses come from the board's columns. Columns SHALL be creatable, renamable, reorderable, and deletable inline in the board view.

#### Scenario: Add a column
- **WHEN** a user with write access adds a column named "In Review" to a board
- **THEN** the column appears at the chosen position in the board view and becomes a selectable status for items on that board

#### Scenario: Rename a column
- **WHEN** a user with write access renames a column
- **THEN** items in that column keep their association with the renamed column and display the new status name

#### Scenario: Delete a non-empty column
- **WHEN** a user with write access deletes a column that still contains items
- **THEN** the system requires the user to choose a target column for those items (or blocks deletion until the column is empty) so that no item is left without a status

### Requirement: Board list view
The system SHALL provide a list view showing the user's favorited boards and all boards the user can access (via direct permission, group permission, or public visibility). The list SHALL allow toggling between "Favorites" and "All" and show at least the board name, its catalog entity (if assigned), and the user's access level.

#### Scenario: List accessible boards
- **WHEN** a user opens the boards list
- **THEN** they see every board they can read — owned, directly shared, shared via one of their groups, or public — and no board they cannot read

#### Scenario: Favorite a board
- **WHEN** a user marks a board as favorite
- **THEN** the board appears in their "Favorites" list on subsequent visits; favorites are per-user and do not affect other users

### Requirement: Optional catalog entity assignment
A board SHALL optionally be assigned to a single catalog entity by entity ref. The assignment SHALL be editable by users with `admin` access and displayed in the board list and board header.

#### Scenario: Assign a board to an entity
- **WHEN** a board admin assigns the board to catalog entity `system:default/payments`
- **THEN** the board stores the entity ref and displays a link to that entity

#### Scenario: Unassign the entity
- **WHEN** a board admin clears the entity assignment
- **THEN** the board has no associated entity and no entity link is shown

### Requirement: Update and delete boards
Users with `admin` access SHALL be able to rename a board and delete it. Deleting a board SHALL delete its columns, items, comments, change history, permissions, favorites, and watches. Users with `write` or `read` access SHALL NOT be able to rename or delete the board.

#### Scenario: Rename a board
- **WHEN** a board admin renames the board inline
- **THEN** the new name is persisted and shown to all users with access

#### Scenario: Delete a board
- **WHEN** a board admin deletes the board and confirms the destructive action
- **THEN** the board and all its data are removed and it disappears from all users' lists

#### Scenario: Non-admin cannot delete
- **WHEN** a user with `write` access attempts to delete the board
- **THEN** the request is rejected with a permission error and the board is unchanged

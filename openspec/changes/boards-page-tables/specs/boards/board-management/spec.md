# Board Management

## MODIFIED Requirements

### Requirement: Board list view
The system SHALL provide a list view showing the user's favorited boards and all boards the user can access (via direct permission, group permission, or public visibility). The list SHALL allow toggling between "Favorites" and "All" and show at least the board name, its catalog entity (if assigned), and the user's access level. Each list SHALL be rendered as a table whose last column is an actions column holding a menu button; activating a row SHALL open the board. The actions menu SHALL also open, anchored at the pointer, when the user right-clicks the row.

#### Scenario: List accessible boards
- **WHEN** a user opens the boards list
- **THEN** they see every board they can read — owned, directly shared, shared via one of their groups, or public — and no board they cannot read

#### Scenario: Favorite a board
- **WHEN** a user marks a board as favorite
- **THEN** the board appears in their "Favorites" list on subsequent visits; favorites are per-user and do not affect other users

#### Scenario: Row actions menu
- **WHEN** a user activates the menu button in a board row's actions column
- **THEN** a menu offers opening the board and toggling its favorite state, and choosing an entry acts on that row's board

#### Scenario: Right-click opens the same menu
- **WHEN** a user right-clicks a board row
- **THEN** the browser context menu is suppressed and the row's actions menu opens at the pointer position

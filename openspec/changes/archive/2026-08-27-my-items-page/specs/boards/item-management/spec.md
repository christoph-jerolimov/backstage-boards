# Item Management

## ADDED Requirements

### Requirement: My items across boards

The system SHALL provide logged-in users a view of all items assigned to
them — via their user ref or any of their ownership group refs — across
every non-archived board they can read. Items on boards the user cannot
access SHALL NOT appear. Archived items SHALL NOT appear. Each entry
SHALL carry the board name and column title so the item is understandable
without opening the board.

#### Scenario: Items collected across boards

- **WHEN** a user is assigned items on two boards they can read and one
  item on a private board they cannot read
- **THEN** the my-items listing contains the items from the two readable
  boards and not the item from the private board

#### Scenario: Group assignment counts as mine

- **WHEN** an item is assigned to a group the user belongs to
- **THEN** it appears in the user's my-items listing

#### Scenario: Anonymous callers rejected

- **WHEN** an anonymous caller requests the my-items listing
- **THEN** the request fails with a not-allowed error

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
groups the user's items by board, shows status, due date (with the
standard urgency colors), and tags, links each board heading to the
board, and opens an item on its board when clicked. The board list page
SHALL link to the sub-page.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

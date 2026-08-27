# Item Management

## MODIFIED Requirements

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
groups the user's items by board, shows status, due date (with the
standard urgency colors), and tags, links each board heading to the
board, and opens an item on its board when clicked. Each board group
SHALL be rendered as a table whose last column is an actions column
holding a menu button, and that menu SHALL also open at the pointer on
right-click. That menu SHALL offer the same item actions as the item menu
on a board — open details, move to another column, set or clear the due
date, and change assignees and delete the item — subject to the same
write-access and externally-managed restrictions, plus an entry that
opens the item's board. After such an action the listing SHALL reflect
the result, including removing an item that is no longer assigned to the
user. The boards page SHALL reach the same listing through its "My items"
tab; a separate button link to the sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details, move it to another column, change its due date and
  assignees, delete it, and open its board

#### Scenario: Change status from the my-items table

- **WHEN** the user moves one of their items to another column from the
  my-items row menu
- **THEN** the item's status changes on its board and the row's status
  cell shows the new column

#### Scenario: Unassigning removes the row

- **WHEN** the user removes themselves as an assignee from the my-items
  row menu, and no group of theirs is assigned to that item
- **THEN** the row disappears from the listing

#### Scenario: Read-only board offers navigation only

- **WHEN** the user opens the row menu for an item on a board they can
  only read, or for an externally managed item
- **THEN** the menu offers to open the item's details and its board, and
  no action that would modify the item

# Item Management

## MODIFIED Requirements

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
groups the user's items by board, shows status, due date (with the
standard urgency colors), and tags, links each board heading to the
board, and opens an item on its board when clicked. Each board group
SHALL be rendered as a table whose last column is an actions column
holding a menu button, and that menu SHALL also open at the pointer on
right-click. The boards page SHALL reach the same listing through its
"My items" tab; a separate button link to the sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details and to open its board

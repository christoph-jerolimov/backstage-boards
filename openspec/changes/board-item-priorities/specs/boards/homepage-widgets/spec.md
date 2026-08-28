# Homepage Widgets

## MODIFIED Requirements

### Requirement: Assigned items widget

The plugin SHALL provide an "Assigned items" widget listing the items
assigned to the current user — directly or through one of their groups —
across every non-archived board the user can read. It SHALL show for each
item at least the item title, its status, its due date when set, and its
priority when the item has one, rendered with the priority's name and
color. Archived items and items on boards the user cannot read SHALL NOT
appear.

Activating an item SHALL navigate to that item on its board with the
item's details open.

#### Scenario: Assigned items are listed

- **WHEN** a user with items assigned on two readable boards views the
  widget
- **THEN** the items from both boards are listed with their title,
  status, and due date

#### Scenario: Priority shown when set

- **WHEN** one listed item carries the priority "critical" and another
  carries none
- **THEN** the first is listed with a "critical" badge in that
  priority's color and the second is listed without a priority badge

#### Scenario: Opening an item from the card

- **WHEN** the user activates one of the listed items
- **THEN** the app navigates to that item's board with the item's details
  open

#### Scenario: Nothing assigned

- **WHEN** the user has no assigned items
- **THEN** the card states that nothing is assigned to them instead of
  rendering an empty list

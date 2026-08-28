# Home Page Widgets

## MODIFIED Requirements

### Requirement: Assigned items widget

The plugin SHALL provide an "Assigned items" widget listing the items
assigned to the current user — directly or through one of their groups —
across every non-archived board the user can read. It SHALL show for each
item at least the item title, its status, and its due date when set.
Archived items and items on boards the user cannot read SHALL NOT appear.

Activating an item SHALL open that item's details over the home page,
without navigating away from it, so the user can inspect and change the
item and return to the card. The card SHALL keep offering a way to reach
the item's board from those details.

The open item SHALL belong to the card it was opened from: a second copy
of the widget on the same home page SHALL NOT open a drawer because the
first one was activated, and the rest of the home page SHALL keep
rendering while the details are open.

#### Scenario: Assigned items are listed

- **WHEN** a user with items assigned on two readable boards views the
  widget
- **THEN** the items from both boards are listed with their title,
  status, and due date

#### Scenario: Opening an item from the card

- **WHEN** the user activates one of the listed items
- **THEN** the item's details open over the home page and the user is
  still on the home page

#### Scenario: Changing an item from the card

- **WHEN** the user changes the item's status in the details opened from
  the card and closes them
- **THEN** the change is saved and the card shows the item's new status
  without a page reload

#### Scenario: Reaching the board from the card's details

- **WHEN** the user has an item's details open from the card and chooses
  to open its board
- **THEN** the app navigates to that board

#### Scenario: Two cards do not share an open item

- **WHEN** two "Assigned items" cards are on the same home page and the
  user activates an item in one of them
- **THEN** only that card opens the item's details

#### Scenario: Nothing assigned

- **WHEN** the user has no assigned items
- **THEN** the card states that nothing is assigned to them instead of
  rendering an empty list

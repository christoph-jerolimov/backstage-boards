## MODIFIED Requirements

### Requirement: Assigned items widget

The plugin SHALL provide an "Assigned items" widget listing the items
assigned to the current user — directly or through one of their groups —
across every non-archived board the user can read. It SHALL show for each
item at least the item title, its status, and its due date when set.
Archived items and items on boards the user cannot read SHALL NOT appear.

Activating an item SHALL open that item's detail drawer in place on the
homepage, without navigating away. The drawer SHALL offer the same detail
view as on the item's board — including editing when the user has write
access to that board, and read-only otherwise. Changes made in the drawer
SHALL be reflected in the card, including removing an item that is no
longer assigned to the user. Closing the drawer SHALL leave the user on
the homepage. The item's board SHALL remain reachable from the card.

#### Scenario: Assigned items are listed

- **WHEN** a user with items assigned on two readable boards views the
  widget
- **THEN** the items from both boards are listed with their title,
  status, and due date

#### Scenario: Opening an item from the card

- **WHEN** the user activates one of the listed items
- **THEN** the item's detail drawer opens on the homepage, without
  navigating to the board

#### Scenario: Editing an item from the homepage drawer

- **WHEN** the user changes an item's status or due date in a drawer
  opened from the card, for an item on a board they can write to
- **THEN** the change is saved to the item's board and the card row
  reflects it after the drawer closes

#### Scenario: Read-only board opens a read-only drawer

- **WHEN** the user activates an item that lives on a board they can
  only read
- **THEN** the drawer opens showing the item's details without any
  editing controls

#### Scenario: Nothing assigned

- **WHEN** the user has no assigned items
- **THEN** the card states that nothing is assigned to them instead of
  rendering an empty list

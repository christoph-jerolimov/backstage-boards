# Item Management

## ADDED Requirements

### Requirement: Item due date

Items SHALL support an optional due date (a calendar date without a time
component). The due date SHALL be settable and clearable by any user with
write access, exposed through the REST API and the item actions, and
changes to it SHALL be recorded in the item change history. Invalid date
values SHALL be rejected.

#### Scenario: Set and clear a due date

- **WHEN** a user with write access sets an item's due date to a valid
  `YYYY-MM-DD` date
- **THEN** the item stores that date and a change entry records the update
- **WHEN** the user clears the due date
- **THEN** the item has no due date and a change entry records the removal

#### Scenario: Invalid due date rejected

- **WHEN** a caller submits a due date that is not a valid calendar date
- **THEN** the request fails with an input error and the item is unchanged

### Requirement: Due date display with urgency colors

The kanban card and the table view SHALL show an item's due date. A due
date of today SHALL render in the warning color, a past due date in the
error color, and a future due date in neutral styling.

#### Scenario: Overdue item highlighted

- **WHEN** an item's due date is before today
- **THEN** the card and the table row show the due date in the error color

#### Scenario: Due-today item highlighted

- **WHEN** an item's due date is today
- **THEN** the card and the table row show the due date in the warning color

### Requirement: Quick due-date menu on cards

Each kanban card SHALL offer users with write access a quick due-date
menu with the options: today, tomorrow, this week (the upcoming Friday,
or today when today is Friday), and remove (only shown when a due date is
set).

#### Scenario: Quick-set to Friday

- **WHEN** a user picks "This week (Fri)" from a card's due-date menu on a
  Wednesday
- **THEN** the item's due date becomes the Friday of the current week

### Requirement: Arbitrary due date in details view

The item details drawer SHALL let users with write access pick any
calendar date as the due date, or clear it.

#### Scenario: Pick a date in the drawer

- **WHEN** a user selects a date three weeks out in the drawer's due-date
  field
- **THEN** the item's due date is updated to that date

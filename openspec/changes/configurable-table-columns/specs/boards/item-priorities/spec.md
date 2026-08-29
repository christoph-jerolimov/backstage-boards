# boards/item-priorities Specification (delta)

## MODIFIED Requirements

### Requirement: Priority display

The kanban card SHALL show its item's priority — the name, rendered with the priority's color when one is set and neutrally otherwise. The board table view SHALL show a priority column only when at least one listed item has a priority and the user has not hidden the column through the table's column menu; the my-items listing SHALL show a priority column only when at least one listed item has a priority; otherwise the column SHALL be absent. The item details drawer SHALL show the item's priority. The "Assigned items" home page widget SHALL show each item's priority when set.

#### Scenario: Card shows the priority

- **WHEN** an item with priority "critical" (red) is shown as a kanban card
- **THEN** the card shows "critical" rendered in red

#### Scenario: Table column only when used

- **WHEN** a user views the table of a board where no item has a priority
- **THEN** no priority column is shown
- **WHEN** at least one item has a priority
- **THEN** the priority column appears and shows each item's priority, empty for items without one

#### Scenario: Table column can be hidden by the user

- **WHEN** a user hides the Priority column through the table's column menu on a board whose items use priorities
- **THEN** the table shows no priority column for that user until they re-enable it

#### Scenario: My-items column only when used

- **WHEN** the my-items listing contains at least one item with a priority
- **THEN** the listing shows a priority column; when none of the listed items has a priority the column is absent

#### Scenario: Assigned-items widget shows priority

- **WHEN** the "Assigned items" home page widget lists an item that has a priority
- **THEN** the entry shows that priority alongside title, status, and due date

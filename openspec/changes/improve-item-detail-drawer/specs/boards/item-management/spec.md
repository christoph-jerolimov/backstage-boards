# boards/item-management Specification (delta)

## MODIFIED Requirements

### Requirement: Arbitrary due date in details view

The item details drawer SHALL present the item's due date as a single combined display-and-editor control: the due-date badge itself (or a "No due date" placeholder). For users with write access on a non-externally-managed item, the badge SHALL open a menu on click and on right-click offering today, tomorrow, this week (the upcoming Friday), a "pick a date" entry, and — when a due date is set — a remove entry; it SHALL be keyboard-focusable and operable via the keyboard and SHALL carry a visible affordance making its select capability discoverable. The "pick a date" entry SHALL replace the badge with a focused date input so the user can pick any calendar date; leaving the input SHALL restore the badge. Read-only users and externally managed items SHALL see only the plain due-date display without a picker.

#### Scenario: Quick option from the badge

- **WHEN** a user with write access opens the drawer's due-date control and picks "Tomorrow"
- **THEN** the item's due date becomes tomorrow's date and the badge shows it

#### Scenario: Pick a date in the drawer

- **WHEN** a user with write access chooses "Pick a date…" and selects a date three weeks out in the focused date input
- **THEN** the item's due date is updated to that date and the badge shows it

#### Scenario: Remove the due date

- **WHEN** a user with write access opens the due-date control of an item with a due date and picks the remove entry
- **THEN** the item has no due date and the control shows the "No due date" placeholder

## ADDED Requirements

### Requirement: Item menu in details drawer
The item details drawer SHALL offer the same item actions menu as the item's card and table row — move to another column, the quick due-date entries, the priority submenu (when the board defines priorities), the assignee submenu, and delete — subject to the same write-access and externally-managed restrictions as elsewhere. The "Open details" entry SHALL be omitted, since the details are already open. The drawer SHALL NOT show a standalone delete button; deletion is offered through the menu. Deleting the item from the drawer's menu SHALL close the drawer. For users who cannot modify the item (read-only access or an externally managed item) the drawer SHALL NOT offer an empty menu.

#### Scenario: Drawer menu offers the full action set
- **WHEN** a user with write access opens the item menu in the details drawer
- **THEN** it offers moving the item to another column, the due-date shortcuts, the priority submenu (on a board with priorities), the assignee submenu, and deleting the item — and no "Open details" entry

#### Scenario: Delete via the drawer menu
- **WHEN** a user with write access deletes the item from the drawer's menu
- **THEN** the item is deleted and the drawer closes

#### Scenario: No standalone delete button
- **WHEN** a user with write access views the details drawer
- **THEN** no standalone "Delete item" button is shown outside the menu

#### Scenario: Read-only users get no empty menu
- **WHEN** a user with only read access, or any user on an externally managed item, views the details drawer
- **THEN** no item actions menu with zero usable entries is offered

### Requirement: Structured details drawer
The item details drawer SHALL group its content into visually separated, headlined sections so each block is identifiable at a glance: the item's fields (status, priority, due date, assignees), the tags, the description, the checklist, and the activity block SHALL each be introduced by a visible heading or label, in that order — tags above the description. The watch control SHALL sit in the drawer header, beside the item menu and close buttons.

#### Scenario: Sections carry headings
- **WHEN** a user opens the item details drawer
- **THEN** the field area, tags, description, checklist, and activity block each appear under a visible heading or label, with the tags above the description

#### Scenario: Watch control in the header
- **WHEN** a user opens the item details drawer
- **THEN** the watch control appears in the drawer header next to the item menu and close buttons

### Requirement: Combined status display and editor in details drawer
The item details drawer SHALL show the item's status as a single control: the status badge itself. For users with write access on a non-externally-managed item, the badge SHALL open a status picker listing the board's columns on click and on right-click, SHALL be keyboard-focusable and operable via the keyboard, and SHALL carry a visible affordance (such as a dropdown indicator) making its select capability discoverable. Choosing a column SHALL move the item to that column. The drawer SHALL NOT additionally show a separate status select. For read-only users and externally managed items the plain, non-interactive badge SHALL be shown without a picker or affordance.

#### Scenario: Change status via the badge
- **WHEN** a user with write access activates the drawer's status badge and picks another column
- **THEN** the item moves to that column and the badge shows the new status

#### Scenario: Keyboard operation
- **WHEN** a user with write access focuses the status badge via the keyboard and opens it with the keyboard
- **THEN** the status picker opens and a column can be chosen without a pointer

#### Scenario: Right-click opens the picker
- **WHEN** a user with write access right-clicks the drawer's status badge
- **THEN** the status picker opens instead of the browser context menu

#### Scenario: Read-only status badge
- **WHEN** a read-only user or any user on an externally managed item views the drawer
- **THEN** the status badge is plain and non-interactive, with no dropdown affordance and no separate status select

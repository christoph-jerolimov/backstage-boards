# boards/item-priorities Specification (delta)

## MODIFIED Requirements

### Requirement: Edit priority from drawer and item menu

The item details drawer SHALL present the item's priority as a single combined display-and-editor control: the priority badge itself. For users with write access on a non-externally-managed item, the badge SHALL open a picker listing the board's priorities ordered by order number ascending plus a clear entry, on click and on right-click; it SHALL be keyboard-focusable and operable via the keyboard and SHALL carry a visible affordance (such as a dropdown indicator) making its select capability discoverable. When the board defines priorities and the item has none, the control SHALL show a neutral "No priority" placeholder. The drawer SHALL NOT additionally show a separate priority select.

The item context menu (on cards, table rows, and the my-items rows) SHALL offer a priority submenu with the board's priorities ordered by order number ascending plus a clear entry, subject to the same write-access and externally-managed restrictions as other item actions; in the my-items listing the offered priorities SHALL be those of the item's own board.

Read-only users and users viewing an externally managed item SHALL see only the plain, non-interactive priority badge (or nothing when the item has no priority); no priority-changing control SHALL be offered.

#### Scenario: Change priority in the drawer

- **WHEN** a user with write access activates the drawer's priority badge and selects "high"
- **THEN** the item's priority becomes "high" without leaving the view, and the badge shows "high"

#### Scenario: Clear priority in the drawer

- **WHEN** a user with write access opens the drawer's priority control on an item with a priority and picks the clear entry
- **THEN** the item has no priority and the control shows the "No priority" placeholder

#### Scenario: Keyboard operation of the priority control

- **WHEN** a user with write access focuses the drawer's priority badge via the keyboard and opens it with the keyboard
- **THEN** the priority picker opens and a priority can be chosen without a pointer

#### Scenario: Change priority from the item menu

- **WHEN** a user opens an item's menu and picks "critical" from the priority submenu
- **THEN** the item's priority becomes "critical" and the card/row updates immediately

#### Scenario: Read-only users see no priority editor

- **WHEN** a user with only read access opens the drawer or item menu
- **THEN** no priority-changing control is offered; in the drawer the priority appears only as a plain badge when set

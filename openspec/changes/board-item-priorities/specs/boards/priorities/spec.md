## Purpose

Gives each board its own ordered vocabulary of item priorities — named,
optionally colored, and rankable — so that items can express importance,
and so that boards can filter, group, and cross-tabulate their work by it.

## ADDED Requirements

### Requirement: Board priority list

A board SHALL have an ordered list of priorities. Each priority SHALL
have a stable identifier, a non-empty name, an optional color from the
board color palette, and an order number. The order number SHALL be
assigned by the system from the priority's position in the list: the
first priority is 1 — the highest priority on that board — and the
numbers SHALL stay contiguous with no gaps or duplicates. A board SHALL
hold at most 10 priorities, and a board with no priorities SHALL be
valid.

Priorities SHALL be identified by their identifier wherever an item
refers to one, so that renaming or recoloring a priority never changes
which items carry it.

#### Scenario: Order numbers are derived from the list position

- **WHEN** a board has the priorities "critical", "high", "medium",
  "low" in that order
- **THEN** their order numbers are 1, 2, 3, and 4 respectively, and
  "critical" is the board's highest priority

#### Scenario: Priority name is required

- **WHEN** an admin tries to create or rename a priority with an empty
  or whitespace-only name
- **THEN** the request is rejected with a validation error and the
  board's priority list is unchanged

#### Scenario: Board is limited to ten priorities

- **WHEN** an admin adds a priority to a board that already has 10
- **THEN** the request is rejected and no eleventh priority is created

#### Scenario: Renaming keeps item assignments

- **WHEN** an admin renames "high" to "important" while items carry it
- **THEN** those items still carry the same priority and now display it
  as "important"

### Requirement: Default priorities for new boards

A newly created board SHALL start with four priorities in this order:
"critical" with the color red, "high" with the color orange, "medium"
with no color, and "low" with no color — giving them the order numbers
1 through 4. Boards that existed before priorities were introduced SHALL
start with no priorities rather than being given the default set.

#### Scenario: New board has the default set

- **WHEN** a user creates a board
- **THEN** the board's priorities are critical (red, 1), high (orange,
  2), medium (no color, 3), and low (no color, 4), and every one of them
  can immediately be renamed, recolored, reordered, or removed

#### Scenario: Pre-existing board has none

- **WHEN** a board created before this capability existed is opened
- **THEN** it has no priorities, no priority affordance is shown for it,
  and an admin can add priorities from its board settings

### Requirement: Configure priorities from board settings

The board settings dialog SHALL let users with `admin` access manage the
board's priorities: add a priority, rename it, set or clear its color,
rearrange the list, and remove a priority. Rearranging SHALL renumber
the affected priorities so the order numbers stay contiguous from 1.
Users without `admin` access SHALL NOT be offered these controls, and
the backend SHALL reject their priority mutations.

#### Scenario: Admin adds a priority

- **WHEN** a board admin adds a priority named "blocker" to a board with
  four priorities
- **THEN** the priority is appended with order number 5 and becomes
  selectable on the board's items

#### Scenario: Admin rearranges priorities

- **WHEN** a board admin moves "low" from the last position to the first
- **THEN** "low" gets order number 1 and the remaining priorities keep
  their relative order with the numbers 2 upwards

#### Scenario: Non-admin cannot configure priorities

- **WHEN** a user with only write access opens board settings, or calls
  the priority endpoints directly
- **THEN** no priority editing controls are offered and the direct calls
  are rejected

### Requirement: Removing a priority that is in use

Removing a priority that no item carries SHALL simply remove it.
Removing a priority that items still carry SHALL require the remover to
choose what happens to those items: reassign all of them to another
priority of the same board, or drop the priority from them so they end
up with no priority. A removal request that makes no such choice SHALL
be rejected and remove nothing. After removal the remaining priorities
SHALL be renumbered contiguously from 1.

#### Scenario: Removing an unused priority

- **WHEN** an admin removes a priority that no item carries
- **THEN** it disappears from the board and the remaining priorities are
  renumbered from 1

#### Scenario: Reassigning the items of a removed priority

- **WHEN** an admin removes "critical" while three items carry it and
  chooses to reassign them to "high"
- **THEN** "critical" is gone and all three items carry "high"

#### Scenario: Dropping the priority from its items

- **WHEN** an admin removes "critical" while items carry it and chooses
  to drop it
- **THEN** "critical" is gone and those items have no priority

#### Scenario: Removal without a choice is rejected

- **WHEN** a removal of a priority that items still carry is requested
  without stating whether to reassign or drop
- **THEN** the request fails with a conflict error and neither the
  priority nor the items change

### Requirement: Item priority

An item SHALL carry at most one priority, and having none SHALL be
valid. The priority SHALL be settable and clearable by any user with
write access on the board, subject to the same externally-managed
restrictions as the item's other fields, and SHALL be exposed through
the REST API. A priority SHALL only be accepted for an item if it
belongs to that item's board. Changes to an item's priority SHALL be
recorded in the item's change history by priority name, so that the
history stays readable after a later rename.

Setting the priority SHALL be possible from the item detail drawer and
from the item actions menu — on a card, on a table row, from the
right-click menu, and from the my-items rows — with the priorities
offered smallest order number first plus an entry that clears it. These
affordances SHALL be offered only for boards that have priorities.

#### Scenario: Set a priority from the item menu

- **WHEN** a user with write access picks "high" in the priority
  submenu of an item's actions menu
- **THEN** the item carries "high", every view of the item shows it, and
  the change appears in the item's history

#### Scenario: Clear a priority from the drawer

- **WHEN** a user with write access clears the priority in an item's
  detail drawer
- **THEN** the item has no priority and no priority badge is rendered
  for it

#### Scenario: Foreign priority rejected

- **WHEN** an item update names a priority belonging to another board
- **THEN** the request is rejected and the item's priority is unchanged

#### Scenario: No priority affordance without priorities

- **WHEN** a user with write access opens the item menu or the drawer on
  a board that has no priorities
- **THEN** no priority control is offered

### Requirement: Priority display

A board card SHALL show the item's priority when it has one, rendered
with the priority's name and its color (a neutral default when the
priority has no color). The board table view and the my-items tables
SHALL show a "Priority" column, and the column SHALL be present only
when the board in question has priorities. A board with no priorities
SHALL look exactly as it did before this capability.

#### Scenario: Card shows the priority

- **WHEN** an item carrying "critical" is rendered as a board card
- **THEN** the card shows a "critical" badge in that priority's color

#### Scenario: Priority column appears only when used

- **WHEN** a user opens the table view of a board that has priorities,
  and then the table view of a board that has none
- **THEN** the first table has a Priority column and the second does not

### Requirement: Filter items by priority

The board's filter bar SHALL offer a priority filter when the board has
priorities, listing the priorities by order number smallest first and
then a "No priority" entry, each with the number of the board's items it
matches. Selecting several entries SHALL match an item carrying any one
of them, and the priority filter SHALL combine with the text and tag
filters by AND. The items API SHALL accept the same priority filter.
Clearing the filters SHALL clear the priority selection with them.

#### Scenario: Filter by one priority

- **WHEN** the user selects "critical" in the priority filter
- **THEN** only the items carrying "critical" remain visible in the
  active view

#### Scenario: Several priorities match any of them

- **WHEN** the user selects "critical" and "high"
- **THEN** items carrying either priority remain visible and items
  carrying neither are hidden

#### Scenario: Unprioritized items

- **WHEN** the user selects "No priority"
- **THEN** only items without a priority remain visible

#### Scenario: Priority filter combines with the others

- **WHEN** the user selects the priority "high" and types "login" into
  the search field
- **THEN** only items that carry "high" and match the text remain
  visible

#### Scenario: No priority filter without priorities

- **WHEN** the user opens the filter bar of a board that has no
  priorities
- **THEN** no priority filter is offered

### Requirement: Group items by priority

The group-by dropdown SHALL offer grouping by priority for boards that
have priorities, in both the board view and the table view. Groups SHALL
be ordered by order number with the smallest first, and items without a
priority SHALL form a final "No priority" group. Each group heading
SHALL show how many items it contains. Empty groups SHALL NOT be
rendered.

#### Scenario: Groups ordered by order number

- **WHEN** the user groups a board by priority
- **THEN** the groups appear in the order critical, high, medium, low,
  followed by "No priority", each labelled with its item count

#### Scenario: Grouping applies to both views

- **WHEN** the user groups by priority and switches between board view
  and table view
- **THEN** both views show the same priority groups in the same order

#### Scenario: Grouping combines with filters

- **WHEN** a filter is active and grouping is by priority
- **THEN** only the filtered items are grouped and counted, and a
  priority left with no matching item is not rendered as a group

#### Scenario: Grouping option hidden without priorities

- **WHEN** the user opens the group-by dropdown on a board that has no
  priorities
- **THEN** the priority option is not offered

### Requirement: Status and priority matrix

The board menu SHALL offer a matrix dialog for boards that have
priorities, showing the board's non-archived items counted by status
(the board's columns) against priority. The matrix SHALL have one row
per priority ordered by order number smallest first plus a final row for
items with no priority, one column per board column in board order, and
SHALL show per-row totals, per-column totals, and the grand total. A
cell with no items SHALL show zero rather than being left blank.

#### Scenario: Matrix counts items per status and priority

- **WHEN** a board has two "critical" items in "Todo" and one in "Done",
  and the user opens the priority matrix
- **THEN** the "critical" row shows 2 under "Todo", 1 under "Done", 0
  under every other column, and a row total of 3

#### Scenario: Unprioritized items have their own row

- **WHEN** the board has items without a priority
- **THEN** they are counted in a final "No priority" row and included in
  the column and grand totals

#### Scenario: Archived items excluded

- **WHEN** the board has archived items
- **THEN** they are counted in no cell of the matrix

#### Scenario: Matrix entry hidden without priorities

- **WHEN** the user opens the board menu of a board with no priorities
- **THEN** no matrix entry is offered

# boards/item-management Delta

## ADDED Requirements

### Requirement: Drag-and-drop drop indicator
While a card is being dragged on the board view, the board SHALL show
a clear insertion indicator at the exact position the card would take
if dropped: before the first card, between any two cards, after the
last card of a column, and in an empty column. The indicator SHALL
follow the pointer as the drag moves and disappear when the drag ends.
Dropping SHALL insert the card exactly where the indicator showed —
also when the lane is grouped, where the drop position SHALL respect
the visible card order of the hovered group. The dragged card itself
SHALL remain visually distinguishable (e.g. dimmed) during the drag.

#### Scenario: Indicator between two cards
- **WHEN** a writer drags a card over the gap between the second and
  third card of a column
- **THEN** an insertion indicator appears between those two cards, and
  dropping places the card between them

#### Scenario: Drop at the end of a column
- **WHEN** a writer drags a card below the last card of a column
- **THEN** an insertion indicator appears after the last card, and
  dropping appends the card at the end of that column

#### Scenario: Drop into an empty column
- **WHEN** a writer drags a card over a column with no cards
- **THEN** the column shows an insertion indicator, and dropping places
  the card there

#### Scenario: Drop position in a grouped lane
- **WHEN** the board is grouped and a writer drops a card between two
  cards of a group section
- **THEN** the card lands exactly between those two cards in that
  section's visible order

## MODIFIED Requirements

### Requirement: Table row selection
The board's table view SHALL let users with write access select item
rows via a leading checkbox per row, tracked by item id. Each rendered
table SHALL offer a select-all checkbox in its header that selects or
clears all selectable rows it shows and renders an indeterminate state
when only some of them are selected. The selection SHALL be one shared,
id-based selection for the whole board page: the board view SHALL show
the same selection on its cards with a visible selected marking, items
SHALL be selectable from either view (checkbox in the table, keyboard
Space in both views), and switching between board and table view SHALL
preserve the selection. Selection SHALL be preserved when the group-by
option changes, and an item appearing in more than one group SHALL
count as a single selection reflected in every group that shows it.
Externally managed items SHALL NOT be selectable, and users without
write access SHALL see no selection checkboxes and no selected
markings. Row selection SHALL NOT open the item drawer.

#### Scenario: Select items and switch grouping
- **WHEN** a writer selects two items in the table and then changes the
  group-by option from "None" to "Assignee"
- **THEN** the same two items remain selected in the regrouped table

#### Scenario: Selection survives switching views
- **WHEN** a writer selects two items in the table view and switches to
  the board view
- **THEN** the same two items' cards show the selected marking, and
  switching back to the table shows both checkboxes still checked

#### Scenario: Multi-group item is one selection
- **WHEN** grouping by assignee shows an item with two assignees in two
  groups and the user selects it in one group
- **THEN** its checkbox is checked in both groups and the selection
  counts one item

#### Scenario: Select all within a group
- **WHEN** the user checks the select-all checkbox of one group's table
- **THEN** all selectable items of that group become selected, and after
  deselecting one row the group's select-all checkbox shows an
  indeterminate state

#### Scenario: Read-only surfaces offer no selection
- **WHEN** a reader views the table, or a writer views a row for an
  externally managed item
- **THEN** the reader sees no checkboxes, and the external item's
  checkbox is disabled so it cannot be selected

### Requirement: Bulk actions on selected items
While at least one item is selected, the board page SHALL show a
bulk-actions bar — in the board view and in the table view alike —
with the number of selected items, a way to clear the selection, and
actions that apply to every selected item: a status dropdown listing
all board columns, an assignee dropdown, a due-date dropdown with the
quick due-date choices (Today, Tomorrow, This week, Remove due date),
and an Archive button. The bar SHALL be hidden while nothing is
selected. In the status dropdown, a column SHALL show a checkmark when
all selected items are in it and a dash when only some are. Choosing a
status SHALL move all selected items to that column, choosing a
due-date option SHALL set (or remove) the due date on all selected
items, and Archive SHALL archive all selected items and clear the
selection. Failures of individual item updates SHALL surface as an
error while the remaining items still update, and the views SHALL
reflect all resulting changes.

#### Scenario: Bar appears only with a selection
- **WHEN** no items are selected
- **THEN** no bulk-actions bar is shown, and it appears as soon as one
  item is selected

#### Scenario: Bulk actions from the board view
- **WHEN** a writer selects three cards in the board view and chooses a
  status from the bulk-actions bar's status dropdown
- **THEN** all three items move to that column on the board

#### Scenario: Bulk status change with mixed indicator
- **WHEN** two selected items are in "Todo" and one in "Doing" and the
  user opens the status dropdown
- **THEN** "Todo" shows a dash, "Doing" shows a dash, other columns show
  no marker, and choosing "Done" moves all three items to "Done"

#### Scenario: Uniform status shows a checkmark
- **WHEN** all selected items are in the "Doing" column and the user
  opens the status dropdown
- **THEN** "Doing" shows a checkmark

#### Scenario: Bulk due date
- **WHEN** the user picks "Tomorrow" from the due-date dropdown
- **THEN** every selected item's due date becomes tomorrow's date, and
  picking "Remove due date" afterwards clears it on every selected item

#### Scenario: Bulk archive
- **WHEN** the user presses the Archive button with three items selected
- **THEN** all three items are archived, disappear from the views, the
  selection is cleared, and the bulk-actions bar disappears

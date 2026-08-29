# boards/item-management Delta

## ADDED Requirements

### Requirement: Table row selection
The board's table view SHALL let users with write access select item
rows via a leading checkbox per row, tracked by item id. Each rendered
table SHALL offer a select-all checkbox in its header that selects or
clears all selectable rows it shows and renders an indeterminate state
when only some of them are selected. Selection SHALL be preserved when
the group-by option changes, and an item appearing in more than one
group SHALL count as a single selection reflected in every group that
shows it. Externally managed items SHALL NOT be selectable, and users
without write access SHALL see no selection checkboxes. Row selection
SHALL NOT open the item drawer.

#### Scenario: Select items and switch grouping
- **WHEN** a writer selects two items in the table and then changes the
  group-by option from "None" to "Assignee"
- **THEN** the same two items remain selected in the regrouped table

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
While at least one item is selected in the board's table view, the view
SHALL show a bulk-actions bar with the number of selected items, a way
to clear the selection, and actions that apply to every selected item:
a status dropdown listing all board columns, an assignee dropdown, a
due-date dropdown with the quick due-date choices (Today, Tomorrow,
This week, Remove due date), and an Archive button. The bar SHALL be
hidden while nothing is selected. In the status dropdown, a column
SHALL show a checkmark when all selected items are in it and a dash
when only some are. Choosing a status SHALL move all selected items to
that column, choosing a due-date option SHALL set (or remove) the due
date on all selected items, and Archive SHALL archive all selected
items and clear the selection. Failures of individual item updates
SHALL surface as an error while the remaining items still update, and
the table SHALL reflect all resulting changes.

#### Scenario: Bar appears only with a selection
- **WHEN** no items are selected
- **THEN** no bulk-actions bar is shown, and it appears as soon as one
  item is selected

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
- **THEN** all three items are archived, disappear from the table, the
  selection is cleared, and the bulk-actions bar disappears

### Requirement: Bulk assignee change
The bulk assignee dropdown SHALL list "Me" (the current user) first,
then the board's other assignees, then a "No assignee" entry. An
assignee entry SHALL show a checkmark when every selected item includes
that assignee and a dash when only some do; the "No assignee" entry
SHALL show a checkmark when no selected item has any assignee and a
dash when only some have none. Choosing an assignee SHALL add them to
every selected item, except when all selected items already include
them, in which case it SHALL remove them from every selected item.
Choosing "No assignee" SHALL clear all assignees from every selected
item.

#### Scenario: Assign to all
- **WHEN** an assignee is present on some but not all selected items
  (shown with a dash) and the user chooses that assignee
- **THEN** the assignee is added to every selected item that was missing
  them, and reopening the dropdown shows a checkmark for that assignee

#### Scenario: Toggle off a uniform assignee
- **WHEN** every selected item includes an assignee (shown with a
  checkmark) and the user chooses that assignee
- **THEN** the assignee is removed from every selected item

#### Scenario: Clear assignees
- **WHEN** the user chooses "No assignee" while some selected items have
  assignees
- **THEN** all assignees are removed from every selected item, and
  reopening the dropdown shows a checkmark on "No assignee"

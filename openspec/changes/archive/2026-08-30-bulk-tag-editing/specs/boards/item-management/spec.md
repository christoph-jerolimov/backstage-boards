## MODIFIED Requirements

### Requirement: Bulk actions on selected items
While at least one item is selected, the board page SHALL show a
bulk-actions bar — in the board view and in the table view alike —
with the number of selected items, a way to clear the selection, and
actions that apply to every selected item: a status dropdown listing
all board columns, an assignee dropdown, a due-date dropdown with the
quick due-date choices (Today, Tomorrow, This week, Remove due date),
a tags dropdown, and an Archive button. The bar SHALL be hidden while
nothing is selected. In the status dropdown, a column SHALL show a
checkmark when all selected items are in it and a dash when only some
are. Choosing a status SHALL move all selected items to that column,
choosing a due-date option SHALL set (or remove) the due date on all
selected items, and Archive SHALL archive all selected items and clear
the selection. Failures of individual item updates SHALL surface as an
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

## ADDED Requirements

### Requirement: Bulk tag change
The bulk tags dropdown SHALL list every tag used on the board's items,
sorted alphabetically, followed by an "Add tag…" entry and a "Remove
all tags" entry. A tag entry SHALL show a checkmark when every selected
item carries that tag and a dash when only some do. Choosing a tag
SHALL add it to every selected item missing it, except when all
selected items already carry it, in which case it SHALL remove it from
every selected item. "Add tag…" SHALL let the user type a tag; the
typed value SHALL be normalized like tags added in the item details
drawer and then added to every selected item missing it. "Remove all
tags" SHALL clear the tags of every selected item.

#### Scenario: Tag a mixed selection
- **WHEN** a tag is present on some but not all selected items (shown
  with a dash) and the user chooses that tag
- **THEN** the tag is added to every selected item that was missing it,
  and reopening the dropdown shows a checkmark for that tag

#### Scenario: Toggle off a uniform tag
- **WHEN** every selected item carries a tag (shown with a checkmark)
  and the user chooses that tag
- **THEN** the tag is removed from every selected item

#### Scenario: Add a new tag to the selection
- **WHEN** the user chooses "Add tag…", types `q3-carryover`, and
  confirms
- **THEN** every selected item gains the `q3-carryover` tag, and the
  dropdown lists it with a checkmark afterwards

#### Scenario: Clear all tags
- **WHEN** the user chooses "Remove all tags" while some selected items
  have tags
- **THEN** every selected item ends up with no tags

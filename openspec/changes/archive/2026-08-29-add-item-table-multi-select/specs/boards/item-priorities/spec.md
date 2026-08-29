# boards/item-priorities Delta

## ADDED Requirements

### Requirement: Bulk priority change
When the board defines priorities, the table view's bulk-actions bar
SHALL offer a priority dropdown listing all board priorities in order
plus a "No priority" entry; on a board without priorities the dropdown
SHALL NOT appear. A priority entry SHALL show a checkmark when every
selected item has that priority and a dash when only some do; the "No
priority" entry SHALL show a checkmark when no selected item has a
priority and a dash when at least one (but not all) has none. Choosing
a priority SHALL set it on every selected item, and choosing "No
priority" SHALL clear the priority on every selected item.

#### Scenario: Bulk set a priority
- **WHEN** the user selects three items with mixed priorities and
  chooses "High" from the bulk priority dropdown
- **THEN** all three items get the "High" priority, and reopening the
  dropdown shows a checkmark on "High"

#### Scenario: Mixed and no-priority indicators
- **WHEN** one selected item has "Low" priority and another has none,
  and the user opens the bulk priority dropdown
- **THEN** "Low" shows a dash, "No priority" shows a dash, and all other
  priorities show no marker

#### Scenario: Clear priorities in bulk
- **WHEN** the user chooses "No priority" while every selected item has
  a priority
- **THEN** the priority is removed from every selected item, and
  reopening the dropdown shows a checkmark on "No priority"

#### Scenario: No priorities defined
- **WHEN** items are selected on a board whose priority list is empty
- **THEN** the bulk-actions bar shows no priority dropdown

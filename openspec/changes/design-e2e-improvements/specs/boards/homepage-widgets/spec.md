# boards/homepage-widgets Delta

## ADDED Requirements

### Requirement: Widget row content is start-aligned

Rows in the "Boards" and "Assigned items" widgets SHALL render their content start-aligned (left-aligned in left-to-right locales), matching the widgets' headings and empty states. Row content SHALL NOT be horizontally centered within the card, regardless of how the activatable row itself is implemented.

#### Scenario: Board rows are left-aligned

- **WHEN** a user views the "Boards" widget listing several boards
- **THEN** every board name (and its count row, when counts are shown) starts at the card's leading edge instead of being centered

#### Scenario: Assigned item rows are left-aligned

- **WHEN** a user views the "Assigned items" widget listing several items
- **THEN** every item row's title and badges start at the card's leading edge instead of being centered

## MODIFIED Requirements

### Requirement: Boards widget item count setting

The "Boards" widget SHALL offer a setting that turns per-status item
counts on or off. When on, each listed board SHALL show the number of
non-archived items in each of its columns, labelled with the column title
and carrying that column's color when one is set. A column with no items
SHALL still be shown with a count of zero, so the board's shape is
readable. When off, no counts SHALL be requested or shown. The default
SHALL be on.

#### Scenario: Counts shown by default

- **WHEN** a "Boards" widget is added to the home page and its settings
  are never opened
- **THEN** the listed boards show their per-status counts

#### Scenario: Counts shown per status

- **WHEN** counts are turned on for a board with three items in "Todo",
  one in "In Progress", and none in "Done"
- **THEN** the board's row shows Todo 3, In Progress 1, and Done 0

#### Scenario: Archived items are not counted

- **WHEN** counts are turned on and one of a column's items is archived
- **THEN** that column's count excludes the archived item

#### Scenario: Counts off

- **WHEN** counts are turned off
- **THEN** the board rows show no counts and no counts are requested

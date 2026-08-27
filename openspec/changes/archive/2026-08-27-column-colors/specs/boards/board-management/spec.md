## ADDED Requirements

### Requirement: Column colors
A column SHALL have an optional display color chosen from a fixed palette by users with write access, from the column's menu. The color SHALL appear as a dot in the kanban column header, as the color of the status badge in the table view, and as the status badge shown in the item detail view. Columns without a color SHALL render with a neutral default.

#### Scenario: Set a column color
- **WHEN** a user with write access picks "green" for the "Done" column
- **THEN** the column header shows a green dot and items of that column show a green status badge in the table and in the detail view

#### Scenario: Neutral default
- **WHEN** a column has no color set
- **THEN** status indicators for that column render in a neutral color

# boards/item-management Delta

## MODIFIED Requirements

### Requirement: Configurable item table columns
The board table view and the my-items listing SHALL each offer these data columns: the title column ("Title" on a board, "Item" on the my-items listing), Status, Priority, Due, Assignees, Tags, Created by, Created, Updated by, and Updated. By default only the title column, Status, Priority, Due, Assignees, and Tags SHALL be visible. Each view SHALL offer a small dropdown menu from which the user can show and hide each column, marked with the current visibility; the title column SHALL always be shown and SHALL NOT be offered for hiding. The menu SHALL be offered from the header cell of the trailing actions column — the otherwise empty header above the per-row menu buttons — rather than as a control floating above or outside the table. The trailing actions column is a control rather than a data column and SHALL NOT be offered; on the my-items listing the conditional board column stays governed by the grouping and SHALL NOT be offered either. The Priority entry remains subject to the priority feature's own rules (no priority column when no listed item has one).

The set of visible columns SHALL be stored per user through the user settings storage, so it survives closing the page and reloading the browser and does not affect other users. Board tables SHALL keep an independent choice per board; the my-items listing SHALL keep one choice of its own, shared by the sub-page and the boards page's "My items" tab.

#### Scenario: Column menu sits in the actions column header

- **WHEN** a user views a board's table view or the my-items listing
- **THEN** the column show/hide menu button is found in the header cell of the trailing actions column, and no separate column-configure control renders above the table

#### Scenario: Default columns

- **WHEN** a user opens a board's table view for the first time
- **THEN** the table shows Title, Status, Priority (when used), Due, Assignees, and Tags — and no Created by, Created, Updated by, or Updated columns

#### Scenario: Show an audit column

- **WHEN** the user opens the column menu and enables "Created"
- **THEN** the table gains a Created column showing each item's creation time

#### Scenario: Hide a default column

- **WHEN** the user disables "Tags" in the column menu
- **THEN** the Tags column disappears from the table while the other columns stay

#### Scenario: Choice persists per user and board

- **WHEN** the user enables "Updated by" on board A and reloads the browser
- **THEN** board A's table still shows the Updated by column, while board B's table keeps its own column set and other users' views are unaffected

#### Scenario: My-items columns configurable with its own stored choice

- **WHEN** the user hides "Tags" on the my-items listing and reloads the browser
- **THEN** the my-items tables show no Tags column — on the sub-page and on the boards page's "My items" tab alike — while every board's own table view keeps its stored column set

#### Scenario: Title cannot be hidden

- **WHEN** the user opens the column menu on either view
- **THEN** no entry offers hiding the title column and the tables always render it

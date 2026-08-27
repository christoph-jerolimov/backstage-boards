## ADDED Requirements

### Requirement: Duplicate a board
Users with read access SHALL be able to duplicate a board from its more menu, choosing a name and whether to copy the source board's columns (including colors) and/or its share settings; items are never copied. The duplicating user SHALL become admin of the copy. Share settings SHALL only be copyable by admins of the source board; the copy otherwise starts private with only the duplicator's admin grant.

#### Scenario: Duplicate with columns
- **WHEN** a user duplicates a board choosing to copy columns
- **THEN** a new board is created with the same column titles, order, and colors, no items, and the user as admin

#### Scenario: Duplicate with share settings
- **WHEN** a source-board admin duplicates it choosing to copy share settings
- **THEN** the copy has the same visibility and permission entries plus the duplicator as admin

#### Scenario: Non-admin cannot copy share settings
- **WHEN** a user without admin access on the source requests share-settings copying
- **THEN** the request is rejected

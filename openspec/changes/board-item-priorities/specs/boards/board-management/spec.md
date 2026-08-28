# Board Management

## MODIFIED Requirements

### Requirement: Create a board
The system SHALL allow an authenticated user to create a board with a name. The creating user SHALL automatically receive the `admin` permission level on the board. A new board SHALL start with a default set of columns and a default set of priorities that the creator can immediately change.

#### Scenario: User creates a board
- **WHEN** an authenticated user creates a board named "Team Alpha"
- **THEN** the board is persisted with the given name, the user is recorded as its creator with `admin` access, and the board appears in the user's board list

#### Scenario: Board creation requires a name
- **WHEN** a user attempts to create a board with an empty or whitespace-only name
- **THEN** the request is rejected with a validation error and no board is created

#### Scenario: New board has default priorities
- **WHEN** an authenticated user creates a board
- **THEN** the board starts with the default priority set, and the creator can rename, recolor, rearrange, or remove those priorities

### Requirement: Duplicate a board
Users with read access SHALL be able to duplicate a board from its more menu, choosing a name and which parts of the source board to copy: its columns (including colors), its items, its entity references, and/or its share settings. The copy SHALL carry the source board's priorities — names, colors, and order — instead of the default set, and copied items SHALL keep the priority they had, mapped to the copy's own priorities. The duplicating user SHALL become admin of the copy. Share settings SHALL only be copyable by admins of the source board; the copy otherwise starts private with only the duplicator's admin grant.

#### Scenario: Duplicate with columns
- **WHEN** a user duplicates a board choosing to copy columns
- **THEN** a new board is created with the same column titles, order, and colors, no items, and the user as admin

#### Scenario: Duplicate carries priorities
- **WHEN** a user duplicates a board whose priorities were customized
- **THEN** the copy has the same priority names, colors, and order numbers, and not the default set

#### Scenario: Copied items keep their priority
- **WHEN** a user duplicates a board choosing to copy columns and items
- **THEN** each copied item carries the copy's priority matching the one it had on the source board

#### Scenario: Duplicate with share settings
- **WHEN** a source-board admin duplicates it choosing to copy share settings
- **THEN** the copy has the same visibility and permission entries plus the duplicator as admin

#### Scenario: Non-admin cannot copy share settings
- **WHEN** a user without admin access on the source requests share-settings copying
- **THEN** the request is rejected

# boards/board-management Delta

## MODIFIED Requirements

### Requirement: Create a board
The system SHALL allow an authenticated user to create a board with a name. When the permission framework is in use, creating a board SHALL additionally require an ALLOW decision for the `boards.new.create` permission; a denied user's create request SHALL be rejected with a permission error and the create affordance SHALL NOT be offered in the UI. The creating user SHALL automatically receive the `admin` permission level on the board. A new board SHALL start with a default set of columns that the creator can immediately change.

#### Scenario: User creates a board
- **WHEN** an authenticated user creates a board named "Team Alpha"
- **THEN** the board is persisted with the given name, the user is recorded as its creator with `admin` access, and the board appears in the user's board list

#### Scenario: Board creation requires a name
- **WHEN** a user attempts to create a board with an empty or whitespace-only name
- **THEN** the request is rejected with a validation error and no board is created

#### Scenario: Creation denied by permission policy
- **WHEN** a user whose permission policy denies `boards.new.create` attempts to create a board
- **THEN** the request is rejected with a permission error and no board is created

### Requirement: Duplicate a board
Users with read access SHALL be able to duplicate a board from its more menu, choosing a name and which parts of the source board to copy: its columns (including colors), its items, its entity references, and/or its share settings. Because duplicating creates a new board, it SHALL be subject to the same `boards.new.create` permission decision as creating a board, and the duplicate affordance SHALL NOT be offered to denied users. The duplicating user SHALL become admin of the copy. Share settings SHALL only be copyable by admins of the source board; the copy otherwise starts private with only the duplicator's admin grant.

#### Scenario: Duplicate with columns
- **WHEN** a user duplicates a board choosing to copy columns
- **THEN** a new board is created with the same column titles, order, and colors, no items, and the user as admin

#### Scenario: Duplicate with share settings
- **WHEN** a source-board admin duplicates it choosing to copy share settings
- **THEN** the copy has the same visibility and permission entries plus the duplicator as admin

#### Scenario: Non-admin cannot copy share settings
- **WHEN** a user without admin access on the source requests share-settings copying
- **THEN** the request is rejected

#### Scenario: Duplicate denied by permission policy
- **WHEN** a user whose permission policy denies `boards.new.create` attempts to duplicate a board
- **THEN** the request is rejected with a permission error and no board is created

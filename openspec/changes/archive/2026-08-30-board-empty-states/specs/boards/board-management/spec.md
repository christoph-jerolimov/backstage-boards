## ADDED Requirements

### Requirement: Not-found page and empty states
When a board cannot be loaded because it does not exist or the caller
may not see it (HTTP 404), the board page SHALL show a not-found state
— a title saying the board was not found, a hint that it may have been
deleted or access may be missing, and a way back to the board list —
instead of a bare error line, and the client SHALL NOT retry the
request. Other load failures SHALL show the error message with a retry
action.

Empty situations SHALL render an explanatory empty state in a
consistent visual style: a board without columns viewed by a reader
SHALL say the board has no columns yet (writers keep the add-column
affordance), and the board list's empty tabs SHALL present their
existing hints (no favorites yet, no boards yet, no boards matching
filters) in the same style.

#### Scenario: Unknown board id
- **WHEN** a user opens a board URL whose id does not resolve (deleted,
  or never existed, or no access)
- **THEN** the page shows "Board not found" with an explanatory hint
  and a "Back to boards" action leading to the board list

#### Scenario: Transient load failure retries
- **WHEN** loading a board fails with a non-404 error
- **THEN** the page shows the error message with a Retry action that
  reloads the board

#### Scenario: Reader on a column-less board
- **WHEN** a user with read access opens a board that has no columns
- **THEN** an empty state explains the board has no columns yet instead
  of a blank area

#### Scenario: Empty board list
- **WHEN** a user with no accessible boards opens the board list's All
  tab without filters
- **THEN** an empty state invites them to create a board

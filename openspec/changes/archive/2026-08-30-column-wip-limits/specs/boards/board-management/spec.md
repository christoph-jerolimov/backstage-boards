## ADDED Requirements

### Requirement: Column WIP limits
A column MAY carry an optional soft WIP limit and an optional hard WIP
limit, each a positive integer, editable by users with write access from
the column's menu. When both are set, the soft limit SHALL NOT exceed
the hard limit; the API SHALL reject invalid limits.

The kanban column header SHALL display the column's item count together
with its limit (count/limit, against the hard limit when set, otherwise
the soft limit). While the count is below every configured limit, the
header SHALL keep its normal appearance. Once the count reaches the
soft limit, the header SHALL take a warning background; once the count
reaches the hard limit, an error background (the hard state wins when
both are reached). Counts SHALL be based on all non-archived items of
the column, regardless of active filters.

The backend SHALL reject creating an item in — and moving an item into —
a column whose non-archived item count has already reached its hard
limit, with a conflict error naming the column and limit. Moves and
reorders within the same column SHALL stay allowed, as SHALL moving
items out, editing them, and archiving them. The UI SHALL disable the
affordances that would put another item into a hard-full column: the
column's add-item row, the move/status entries for that column in item
menus and status pickers, and dropping a card from another column.

#### Scenario: Configure limits from the column menu
- **WHEN** a user with write access opens the column menu, chooses "WIP
  limits", enters a soft limit of 3 and a hard limit of 5, and saves
- **THEN** the column stores both limits and the header shows the item
  count as "n/5"

#### Scenario: Invalid limits are rejected
- **WHEN** limits are submitted where the soft limit exceeds the hard
  limit, or a limit is zero or negative
- **THEN** the API rejects the update with an input error and the
  column's limits stay unchanged

#### Scenario: Soft limit turns the header to warning
- **WHEN** a column with a soft limit of 3 (and no hard limit, or a hard
  limit not yet reached) holds 3 items
- **THEN** the column header takes the warning background

#### Scenario: Hard limit turns the header to error and blocks entry
- **WHEN** a column with a hard limit of 5 holds 5 items
- **THEN** the column header takes the error background, the column's
  add-item row is disabled, its entries in move/status menus are
  disabled, and a card from another column cannot be dropped there

#### Scenario: Backend enforces the hard limit
- **WHEN** an API call tries to create an item in, or move an item from
  another column into, a column whose count has reached its hard limit
- **THEN** the call fails with a conflict error and the column's items
  are unchanged

#### Scenario: Reordering inside a full column stays allowed
- **WHEN** a column is at its hard limit and a user reorders items
  within it or moves an item out of it
- **THEN** the operations succeed

#### Scenario: Limits are optional
- **WHEN** a column has no limits configured
- **THEN** the header shows the plain count and nothing is ever
  disabled or recolored for WIP reasons

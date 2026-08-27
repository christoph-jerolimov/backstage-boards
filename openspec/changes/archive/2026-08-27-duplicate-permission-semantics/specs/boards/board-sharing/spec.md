# Board Sharing

## ADDED Requirements

### Requirement: Duplicated boards belong to the duplicator

When a board is duplicated, the duplicating user SHALL be the copy's
first permission with admin level, whether or not share settings are
copied. Copied share entries SHALL be added as additional rules, and
any copied entry with admin level other than the duplicating user SHALL
be downgraded to write. Read and write entries SHALL copy unchanged.

#### Scenario: Foreign admins downgraded

- **WHEN** a board where another user has admin access is duplicated
  with share settings
- **THEN** the copy grants that user write access and the duplicator
  admin access

#### Scenario: Read and write rules copied as-is

- **WHEN** a board with a read grant and a write grant is duplicated
  with share settings
- **THEN** the copy contains the same grants at the same levels

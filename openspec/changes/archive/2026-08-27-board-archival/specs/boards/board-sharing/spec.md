## ADDED Requirements

### Requirement: Archived board access rules
On an archived board, only principals with admin access SHALL be able to read (board, items, comments, history); reads by any other principal SHALL fail as not-found regardless of prior grants or public visibility. Every write operation — items, columns, comments, permissions, board settings — SHALL be rejected for all principals while the board is archived; only the admin hard-delete is allowed.

#### Scenario: Non-admin reads fail
- **WHEN** a user with write access (or a public/logged-in visibility grant) requests an archived board
- **THEN** the request fails as not-found

#### Scenario: Writes fail for everyone
- **WHEN** any principal, including an admin or a service, attempts to modify an archived board or its items
- **THEN** the request is rejected with an archived-board error

#### Scenario: Admin reads stay possible
- **WHEN** an admin opens the archived board via its link
- **THEN** the board, its items, and its history are readable

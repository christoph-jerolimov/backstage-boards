# boards/board-sharing Specification

## Purpose
Controls who can see and change a board: per-user and per-group permission levels plus board-wide public access modes, all manageable from the UI.

## Requirements

### Requirement: Permission levels
The system SHALL support three permission levels for board access: `admin` (manage board settings, columns, permissions, delete board, plus everything below), `write` (add/update/move/delete items, comment, edit labels/tags, manage columns), and `read` (view the board and its items, comments, and history). A user's effective level SHALL be the highest level granted by any of: direct user permission, a permission of a group the user belongs to, or the board's public access mode.

#### Scenario: Effective permission is the highest grant
- **WHEN** a user has direct `read` access and is a member of a group with `write` access on the same board
- **THEN** the user's effective access is `write`

#### Scenario: Read-only user cannot modify
- **WHEN** a user with effective `read` access attempts to create, update, move, or delete an item
- **THEN** the request is rejected with a permission error

### Requirement: Share with users and groups
Users with `admin` access SHALL be able to add and remove permission entries for catalog users (`user:...`) and groups (`group:...`) with a chosen level, from the board UI. The share dialog SHALL list current entries with their level and allow changing a level inline.

#### Scenario: Share with a user
- **WHEN** a board admin adds `user:default/christoph` with level `write`
- **THEN** that user can immediately open the board and modify items

#### Scenario: Share with a group
- **WHEN** a board admin adds `group:default/team-a` with level `read`
- **THEN** every member of that group can view the board

#### Scenario: Revoke access
- **WHEN** a board admin removes a permission entry
- **THEN** the affected principal loses access derived from that entry (retaining any access from other grants or public modes)

#### Scenario: Last admin protection
- **WHEN** a board admin attempts to remove or downgrade the only remaining `admin` permission entry
- **THEN** the request is rejected so that every board always has at least one admin

### Requirement: Public access modes
A board SHALL have a visibility setting, changeable by admins from the UI, with the modes: `private` (only explicit user/group grants), `logged-in read`, `logged-in write` (any authenticated user), `public read` (anyone, including unauthenticated requests, read-only), and `public write` (anyone may read and write). Public and logged-in modes SHALL never grant `admin`.

#### Scenario: Any logged-in user can access
- **WHEN** a board's visibility is set to `logged-in write` and an authenticated user without an explicit grant opens it
- **THEN** the user can view and modify items but cannot change board settings or permissions

#### Scenario: Public read-only board
- **WHEN** a board's visibility is `public read` and an unauthenticated request fetches the board
- **THEN** the board and items are returned read-only, and any mutation attempt is rejected

#### Scenario: Private board is hidden
- **WHEN** a board is `private` and a user without any grant requests it
- **THEN** the request is rejected as not found or forbidden and the board does not appear in that user's list

### Requirement: Access enforcement in the backend
All permission checks SHALL be enforced by the backend on every API request and action invocation; the frontend SHALL additionally hide or disable controls the current user is not allowed to use.

#### Scenario: API bypass attempt
- **WHEN** a user with `read` access calls the item update endpoint directly, bypassing the UI
- **THEN** the backend rejects the request with a permission error

### Requirement: Catalog-backed principal selection
The share dialog SHALL offer autocomplete over the catalog's User and Group entities when adding a permission entry, and SHALL NOT offer a free-text option (share principals must be catalog users or groups).

#### Scenario: Pick a share principal
- **WHEN** a board admin types into the share dialog's principal picker
- **THEN** matching catalog users and groups are suggested and selecting one fills the entry to add

#### Scenario: No free-text principals
- **WHEN** a board admin's input matches no catalog user or group
- **THEN** no free-text option is offered and nothing can be added from that input

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

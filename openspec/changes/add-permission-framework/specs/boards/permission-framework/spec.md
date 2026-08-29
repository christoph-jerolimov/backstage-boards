# boards/permission-framework Delta

## Purpose

Integrates the Boards plugin with Backstage's permission framework through optional plugin-level permissions that gate overall plugin access and board creation, while leaving everything within a board to the plugin's own share feature.

## ADDED Requirements

### Requirement: Plugin permissions are defined and registered

The plugin SHALL define two permissions in its common package so both frontend and backend can reference them: a basic permission `boards.use` and a create permission `boards.new.create`. The backend SHALL register both with Backstage's permission framework so that installation-defined permission policies receive them by their names and attributes.

#### Scenario: Permissions are available to policy authors

- **WHEN** an installation's permission policy receives an authorization request originating from the Boards plugin
- **THEN** the request identifies the permission as `boards.use` or `boards.new.create`, letting the policy decide by permission name or attributes

#### Scenario: Permissions are importable by integrators

- **WHEN** an integrator writes a permission policy or frontend gate for boards
- **THEN** both permission definitions can be imported from the plugin's common package

### Requirement: The use permission gates all user-invoked API calls

The backend SHALL evaluate the `boards.use` permission for every user-invoked API call, using the calling credentials, before performing the operation. When the decision is DENY, the call SHALL be rejected with a permission error and no data SHALL be read or changed. Service-to-service endpoints and scheduled background work SHALL NOT be subject to this permission.

#### Scenario: Denied user cannot call the API

- **WHEN** a user whose policy denies `boards.use` calls any user-facing boards endpoint
- **THEN** the request is rejected with a permission error and nothing is read or modified

#### Scenario: Allowed user proceeds to existing checks

- **WHEN** a user granted `boards.use` calls a boards endpoint
- **THEN** the request proceeds and is still subject to the board's own share-feature access rules

#### Scenario: Service-to-service traffic is exempt

- **WHEN** another backend plugin calls the service-only entity-references endpoint, or a scheduled task (reminders, purge) runs
- **THEN** the `boards.use` permission is not evaluated and the operation behaves as before

#### Scenario: Anonymous callers are evaluated too

- **WHEN** an unauthenticated visitor calls a boards endpoint in a deployment that permits anonymous access
- **THEN** the `boards.use` decision is evaluated for the anonymous credentials, and only on ALLOW does the existing public-board visibility logic apply

### Requirement: The use permission gates the Boards page

The Boards page (and the navigation item leading to it) SHALL be visible only to users granted the `boards.use` permission. A user who is denied SHALL NOT see boards navigation, and opening a boards URL directly SHALL NOT render board content.

#### Scenario: Denied user sees no boards UI

- **WHEN** a user whose policy denies `boards.use` opens the app
- **THEN** the boards navigation item is not shown, and navigating to a boards URL directly shows an access/not-found state instead of board content

#### Scenario: Allowed user sees the page

- **WHEN** a user granted `boards.use` opens the app
- **THEN** the boards navigation item and page work as before

### Requirement: The create permission gates new boards

The `boards.new.create` permission SHALL decide whether a user may bring a new board into existence, so an installation can choose between admin-managed boards and open creation. It SHALL be evaluated in addition to `boards.use` for every operation that creates a board. Frontend affordances for creating a board SHALL be hidden or disabled for users who are denied.

#### Scenario: Denied user cannot create a board

- **WHEN** a user whose policy denies `boards.new.create` attempts to create a board through any user-facing path
- **THEN** the request is rejected with a permission error and no board is created

#### Scenario: Creation affordances follow the decision

- **WHEN** a user whose policy denies `boards.new.create` views the board list
- **THEN** the create-board affordance is not offered, while boards they can access remain usable

### Requirement: Permission framework use is optional

The plugin SHALL work fully without the permission framework: when the framework is disabled or the installation's policy allows everything, all behavior SHALL be identical to the plugin without this capability. Plugin permissions SHALL NOT grant or deny access within a board; per-board access SHALL remain governed solely by the plugin's share feature.

#### Scenario: Disabled framework changes nothing

- **WHEN** the installation runs with the permission framework disabled or an allow-all policy
- **THEN** every page, tab, widget, endpoint, and action behaves exactly as it did before this capability existed

#### Scenario: Plugin permissions do not bypass sharing

- **WHEN** a user granted `boards.use` opens a private board they have no share-feature access to
- **THEN** access is denied by the share feature exactly as before

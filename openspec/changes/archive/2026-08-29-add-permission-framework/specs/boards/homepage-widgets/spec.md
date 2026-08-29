# boards/homepage-widgets Delta

## ADDED Requirements

### Requirement: Widgets require the use permission

When the permission framework is in use, a placed boards home page widget SHALL render nothing (or an unobtrusive empty state) for a user who is denied the `boards.use` permission, and SHALL NOT issue boards API calls on that user's behalf.

#### Scenario: Denied user sees no widget content

- **WHEN** a user whose permission policy denies `boards.use` opens a home page containing a boards widget
- **THEN** the widget shows no board data and triggers no failing boards API requests

#### Scenario: Allowed user is unaffected

- **WHEN** a user granted `boards.use` opens a home page containing a boards widget
- **THEN** the widget loads and behaves as before

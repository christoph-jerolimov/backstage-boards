## Purpose
Configurable audit logging for the boards backend: operational audit
events for API requests, emitted through Backstage's core auditor
service and gated by app-config.

## ADDED Requirements

### Requirement: Configurable audit logging
The boards backend SHALL support audit logging of its HTTP API through
the Backstage auditor service, controlled by the `boards.audit`
app-config value: `none` (the default) SHALL emit no audit events,
`writes` SHALL audit every mutating request (POST, PUT, PATCH,
DELETE), and `all` SHALL additionally audit read requests (GET). An
invalid configuration value SHALL fail plugin startup rather than
silently disable auditing. Each audit event SHALL be associated with
the request (so the auditor records the acting principal) and carry
the HTTP method and path; the event SHALL resolve as success or
failure according to the response status, failures carrying the
status. Audit logging SHALL NOT change the API's behavior or
responses.

#### Scenario: Writes-only auditing
- **WHEN** `boards.audit` is `writes` and a user creates an item and
  then lists items
- **THEN** an audit event is emitted for the creation but none for the
  listing

#### Scenario: Full auditing
- **WHEN** `boards.audit` is `all` and a user lists items
- **THEN** an audit event is emitted for the read as well

#### Scenario: Auditing off
- **WHEN** `boards.audit` is unset or `none`
- **THEN** no audit events are emitted

#### Scenario: Failures are audited as failures
- **WHEN** auditing is enabled and a request fails with an error status
- **THEN** the audit event resolves as a failure carrying the status

#### Scenario: Invalid configuration
- **WHEN** `boards.audit` is set to an unknown value
- **THEN** the backend refuses to start with a configuration error
